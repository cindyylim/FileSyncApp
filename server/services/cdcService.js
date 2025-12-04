import File from '../models/File.js';

/**
 * CDC Service using MongoDB Change Streams
 * Watches for changes in the File collection and broadcasts to Socket.io clients
 */
export class CDCService {
    constructor(io) {
        this.io = io;
        this.changeStream = null;
        this.userSockets = new Map(); // Map of userId -> Set of socket IDs
    }

    /**
     * Start watching for changes in File collection
     */
    async start() {
        try {
            // Create change stream watching for insert, update, and delete operations
            this.changeStream = File.watch([
                {
                    $match: {
                        operationType: {
                            $in: ['insert', 'update', 'delete', 'replace']
                        },
                    },
                },
            ], {
                fullDocument: 'updateLookup', // Get full document on updates
            });

            console.log('🔄 CDC Service: Change Stream started');

            // Listen for change events
            this.changeStream.on('change', (change) => {
                this.handleChange(change);
            });

            this.changeStream.on('error', (error) => {
                console.error('❌ CDC Service: Change Stream error:', error);
                // Attempt to reconnect
                setTimeout(() => this.start(), 5000);
            });

            this.changeStream.on('close', () => {
                console.log('⚠️  CDC Service: Change Stream closed');
            });

        } catch (error) {
            console.error('❌ CDC Service: Failed to start Change Stream:', error);
            console.error('   Make sure MongoDB is running as a replica set!');
        }
    }

    /**
     * Handle incoming change events
     */
    async handleChange(change) {
        try {
            const { operationType, fullDocument, documentKey } = change;

            console.log(`📡 CDC Event: ${operationType} for file ${documentKey._id}`);

            // Get the document (fullDocument is null for delete operations)
            let document = fullDocument;

            if (operationType === 'delete') {
                // For deletes, we need to get the document from update description
                // or track it separately. For now, just broadcast the ID
                document = { _id: documentKey._id };
            }

            if (!document || !document.owner) {
                return;
            }

            const userId = document.owner.toString();

            // Broadcast to all connected devices of this user
            this.broadcastToUser(userId, {
                type: operationType,
                file: this.sanitizeFile(document),
            });

        } catch (error) {
            console.error('❌ CDC Service: Error handling change:', error);
        }
    }

    /**
     * Broadcast event to all sockets of a specific user
     */
    broadcastToUser(userId, data) {
        const socketIds = this.userSockets.get(userId);

        if (!socketIds || socketIds.size === 0) {
            return; // User not connected
        }

        console.log(`📤 Broadcasting to ${socketIds.size} devices for user ${userId}`);

        socketIds.forEach((socketId) => {
            this.io.to(socketId).emit('file:change', data);
        });
    }

    /**
     * Register a user's socket connection
     */
    registerUserSocket(userId, socketId) {
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }

        this.userSockets.get(userId).add(socketId);
        console.log(`✅ User ${userId} connected (socket: ${socketId})`);
    }

    /**
     * Unregister a user's socket connection
     */
    unregisterUserSocket(userId, socketId) {
        const sockets = this.userSockets.get(userId);

        if (sockets) {
            sockets.delete(socketId);

            if (sockets.size === 0) {
                this.userSockets.delete(userId);
            }
        }

        console.log(`👋 User ${userId} disconnected (socket: ${socketId})`);
    }

    /**
     * Sanitize file object before sending to client
     */
    sanitizeFile(file) {
        if (!file) return null;

        return {
            id: file._id,
            filename: file.filename,
            originalName: file.originalName,
            size: file.size,
            mimeType: file.mimeType,
            path: file.path,
            uploadStatus: file.uploadStatus,
            isDeleted: file.isDeleted,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
            // Don't send S3 details or chunks to client
        };
    }

    /**
     * Stop the change stream
     */
    async stop() {
        if (this.changeStream) {
            await this.changeStream.close();
            console.log('⏹️  CDC Service: Change Stream stopped');
        }
    }
}

export default CDCService;
