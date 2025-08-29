// Run this script to get the Clerk user ID for a specific email
// Usage: node get-user-id.js

require('dotenv').config({ path: '.env.local' });
const { createClerkClient } = require('@clerk/backend');

// Initialize Clerk client with your secret key
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function getUserIdByEmail(email) {
  try {
    console.log(`Looking up user ID for email: ${email}`);
    
    const users = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    if (users.totalCount === 0) {
      console.log(`No user found with email: ${email}`);
      console.log('Make sure the user has signed up first.');
      return null;
    }

    const user = users.data[0];
    console.log(`Found user:`);
    console.log(`- User ID: ${user.id}`);
    console.log(`- Email: ${user.emailAddresses[0]?.emailAddress}`);
    console.log(`- Username: ${user.username || 'No username set'}`);
    console.log(`- Created: ${user.createdAt}`);
    
    return user.id;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

// Run the function
getUserIdByEmail('rayhaanoffice@gmail.com')
  .then(userId => {
    if (userId) {
      console.log('\n=== NEXT STEPS ===');
      console.log('Add this to your .env.local file:');
      console.log(`NEXT_PUBLIC_ADMIN_USER_ID=${userId}`);
      console.log('\nOr if you already have admins, add to ADMIN_USER_IDS:');
      console.log(`ADMIN_USER_IDS=${userId}`);
    }
  })
  .catch(console.error);
