import * as admin from 'firebase-admin';

export const firebaseAdminProvider = {
  provide: 'FIREBASE_ADMIN',
  useFactory: () => {
    if (!process.env.PROJECT_ID || !process.env.CLIENT_EMAIL || !process.env.PRIVATE_KEY) {
      throw new Error('❌ Missing Firebase credentials in env');
    }//else{
    //     console.log(process.env.PROJECT_ID);
    //     console.log(process.env.CLIENT_EMAIL);
    //     console.log(process.env.PRIVATE_KEY);
    // }

    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.PROJECT_ID,
        clientEmail: process.env.CLIENT_EMAIL,
        privateKey: (process.env.PRIVATE_KEY as string).replace(/\\n/g, '\n'),
      }),
    });

    return app;
  },
};
