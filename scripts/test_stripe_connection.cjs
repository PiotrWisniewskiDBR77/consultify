require('dotenv').config();
const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
    console.error('Error: STRIPE_SECRET_KEY is missing from .env');
    process.exit(1);
}

const stripe = new Stripe(secretKey);

async function testConnection() {
    console.log('Testing Stripe connection...');
    try {
        // Basic test: Verify the balance to ensure the key works
        const balance = await stripe.balance.retrieve();
        console.log('Success! Connected to Stripe.');
        console.log('Balance available:', balance.available);
        console.log('Live mode:', balance.livemode);
    } catch (error) {
        console.error('Stripe connection failed:', error.message);
        if (error.type === 'StripeAuthenticationError') {
            console.error('Authentication failed. Check your API key.');
        }
    }
}

testConnection();
