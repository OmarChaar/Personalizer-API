import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://personalizer-portal.firebaseio.com'
});

const db = admin.firestore();

const app = express();
app.use(cors());

// enable CORS for all requests
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

async function findAccount(id: any) {
    const accountRef = db.collection('accounts').doc(id);
    const accountSnapshot = await accountRef.get();

    if (!accountSnapshot.exists) {
        return false; // No account found
    }

    const accountData = accountSnapshot.data();

    const subcollections = await accountRef.listCollections();
    const subcollectionData = await Promise.all(subcollections.map(async (subcollection) => {
        const documents = await subcollection.get();
        return {
        [subcollection.id]: documents.docs.map((doc) => doc.data()),
        };
    }));

    return {
        ...accountData,
        ...subcollectionData.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
    };
}

app.get('/getAccount', async (req, res) => {
    const id = req.query.id;

    const result = await findAccount(id);
    if (result) {
        res.json(result);
    } else {
        res.status(404).send('Account not found');
    }
});

async function findClient(id: any, apartment: any) {

    const querySnapshot = await db.collection('clients').where('cpf_cnpj', '==', id).where('apartment', '==', apartment).get();
    if (querySnapshot.empty) {
        return false; // No client found
    } else {
        return querySnapshot.docs[0].data(); // Return the first matching client
    }
}

app.get('/getClient', async (req, res) => {
    const client = {id: req.query.id, apartment: req.query.apartment};

    const result = await findClient(client.id, client.apartment);
    if (result) {
        res.json(result);
    } else {
        res.status(404).send('Client not found');
    }
});

app.get('/getSections', async (req, res) => {
    try {
        const { id } = req.query; 
        const sectionsRef = db.collection(`accounts/${id}/sections`);
        const snapshot = await sectionsRef.get();
        const sections = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        res.json({ sections });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal server error');
    }
});

export const api = functions.https.onRequest(app);

export const updateClients = functions.firestore
    .document('accounts/{accountId}/clients/{clientId}')
    .onWrite(async (change, context) => {

        const clientId = context.params.clientId;
        
        const updatedData = change.after.data();

        const clientDocRef = db.collection('clients').doc(clientId);
        const clientDoc = await clientDocRef.get();

        if (!clientDoc.exists) {
            await clientDocRef.set({ clientId, ...updatedData });
        } 
        else {
            if(updatedData) {
                await clientDocRef.update(updatedData);
            }
         
        }
});