import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://personalizer-portal.firebaseio.com'
});

const db = admin.firestore();

async function findClient(id: any, apartment: any) {

    const querySnapshot = await db.collection('clients').where('cpf_cnpj', '==', id).where('apartment', '==', apartment).get();
    if (querySnapshot.empty) {
        return false; // No client found
    } else {
        return querySnapshot.docs[0].data(); // Return the first matching client
    }
}

export const getClient = functions.https.onRequest(async (req, res) => {
    const client = {id: req.query.id, apartment: req.query.apartment};

    const result = await findClient(client.id, client.apartment);
    if (result) {
        res.json(result);
    } else {
        res.status(404).send('Client not found');
    }
});

export const getSections = functions.https.onRequest(async (req, res) => {
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


// firebase deploy --only functions