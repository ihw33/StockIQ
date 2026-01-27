
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from specific path
dotenv.config({ path: path.resolve(__dirname, '../services/ai-engine/.env') });

import { KiwoomRestProvider } from '../lib/providers/kiwoom-rest-provider';

async function testAuth() {
    const appKey = process.env.KIWOOM_APP_KEY;
    const appSecret = process.env.KIWOOM_SECRET_KEY;

    if (!appKey || !appSecret) {
        console.error('❌ Missing Kiwoom Credentials in .env');
        console.log('AppKey:', appKey ? 'Found' : 'Missing');
        console.log('SecretKey:', appSecret ? 'Found' : 'Missing');
        process.exit(1);
    }

    console.log('🔑 Initializing Kiwoom Provider with Keys...');
    console.log(`AppKey: ${appKey.substring(0, 5)}...`);

    const provider = new KiwoomRestProvider({
        appKey,
        appSecret,
        baseUrl: 'https://api.kiwoom.com' // Changed to production URL
    });

    try {
        console.log('🚀 Attempting to authenticate...');
        // We call getQuote because it triggers getAccessToken internally in our current implementation
        await provider.getQuote('005930');
        console.log('✅ Authentication Successful!');
        console.log('🎉 We successfully obtained an OAuth Token from Kiwoom REST API.');
    } catch (error: any) {
        console.error('❌ Authentication Failed:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
        }
    }
}

testAuth();
