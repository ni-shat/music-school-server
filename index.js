const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9r1od98.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("musicSchool").collection("users");
    const popularClassesCollection = client.db("musicSchool").collection("popularClasses");
    const popularInstructorsCollection = client.db("musicSchool").collection("musicInstructor");


    //user related apis
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });


    //popular classes related apis
    app.get('/popular-classes', async (req, res) => {
      const result = await popularClassesCollection.find().toArray();
      res.send(result); 
    })


    //instructors related apis
    app.get('/popular-instructors', async (req, res) => {
      const result = await popularInstructorsCollection.find().toArray();
      res.send(result); 
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('music server is running')
})

app.listen(port, () => {
    console.log(`music server is running on ${port}`);
})