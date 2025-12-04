import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

dotenv.config();

const check = async () => {
    console.log('🔍 Checking environment...');

    // 1. Check Environment Variables
    const required = ['MONGODB_URI', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME', 'AWS_REGION'];
    const missing = required.filter(key => !process.env[key] || process.env[key].includes('your-'));

    if (missing.length > 0) {
        console.error('❌ Missing or default environment variables:', missing.join(', '));
        console.error('   Please edit .env and add your actual credentials.');
        process.exit(1);
    } else {
        console.log('✅ Environment variables present');
    }

    // 2. Check MongoDB Connection
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');

        const admin = mongoose.connection.db.admin();
        const replStatus = await admin.command({ replSetGetStatus: 1 }).catch(() => null);

        if (replStatus) {
            console.log('✅ Replica Set is active');
        } else {
            console.error('❌ MongoDB is NOT running as a replica set!');
            console.error('   CDC requires a replica set. Please run: docker-compose up -d');
        }
    } catch (err) {
        console.error('❌ MongoDB Connection Failed:', err.message);
    }

    // 3. Check S3 Connection
    try {
        console.log('⏳ Checking S3 connection...');
        const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });

        await s3.send(new ListBucketsCommand({}));
        console.log('✅ S3 Connection Successful');
    } catch (err) {
        console.error('❌ S3 Connection Failed:', err.message);
    }

    process.exit(0);
};

check();
