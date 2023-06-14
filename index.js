const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


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
    const classCollection = client.db("musicSchool").collection("classes");
    const selectedClassCollection = client.db("musicSchool").collection("selectedClasses");
    const paymentCollection = client.db("musicSchool").collection("payments");


    const popularClassesCollection = client.db("musicSchool").collection("popularClasses");
    const popularInstructorsCollection = client.db("musicSchool").collection("musicInstructor"); //popular instructors
    const instructorsCollection = client.db("musicSchool").collection("instructors");
    // const selectedClassCollection = client.db("musicSchool").collection("selectedClassOfStdnts");
    const enrolledClassCollection = client.db("musicSchool").collection("enrolledClassOfStdnts");

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    //jwt token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '3h' })
      res.send({ token })
    })


    /*------------user & admin related apis---------
    -----------------------------------------------------*/
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

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

    app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    //secure admin routes
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    //managing user - make admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // managing user - make instructor
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // approve class
    app.patch('/approval-action/:id', async (req, res) => {
      const id = req.params.id;
      const action = req.query.action;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: action
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // feedback for denied class
    app.post('/classes/feedback/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const { textareaValue } = req.body; console.log(textareaValue)

      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: textareaValue
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })



    // all classes of added by instructors
    app.get('/all-instructor-classes/admin', async (req, res) => {
      // const email = req.query.email;
      // if (!email) {
      //   res.send([]);
      // }
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    //popular classes related apis
    app.get('/popular-classes', async (req, res) => {
      const result = await popularClassesCollection.find().toArray();
      res.send(result);
    })


    /*-------------instructors related apis---------
    -----------------------------------------------------*/
    app.get('/all-instructors', async (req, res) => {
      const query = { role: 'instructor' }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/instructors', async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = 5;
      const skip = page * limit;
      const query = { role: 'instructor' }
      const result = await usersCollection.find(query).skip(skip).limit(limit).toArray();
      res.send(result);
    })

    // total classes by an instructor
    app.get('/instructors-total-classes', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    }) //TODO

    //secure instructor route
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

    app.get('/popular-instructors', async (req, res) => {
      const result = await popularInstructorsCollection.find().toArray();
      res.send(result);
    })

    // all classes of an instruc
    app.get('/all-classes', async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })


    //delete class
    app.delete('/all-classes/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result);
    })

    app.post('/add-a-class', async (req, res) => {
      const cls = req.body;
      // const email = req.query.email;

      const result = await classCollection.insertOne(cls);
      res.send(result);
    });


    /*-------------student related apis---------
    -----------------------------------------------------*/
    app.get('/selected-classes', verifyJWT, async (req, res) => {

      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/enrolled-classes', async (req, res) => {
      const email = req.query.email;
      const query = {
        $and: [
          { status: 'enrolled' },
          { userEmail: email },
        ]
      }
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    //secure student route
    app.get('/users/student/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ student: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { student: user?.role === 'student' }
      res.send(result);
    })

    app.post('/selected-classes/:id', async (req, res) => {
      const saveclass = req.body;
      const email = req.query.email; console.log(email)
      const classId = req.params.id;
      const query = {
        $and: [
          { classId: classId },
          { userEmail: email },
        ]
      }
      const existingClass = await selectedClassCollection.findOne(query);
      console.log("existingClass", existingClass)
      if (existingClass) {
        console.log('already exist')
        return res.send({})
      }

      const result = await selectedClassCollection.insertOne(saveclass);
      res.send(result);
    })  

    app.get('/payment-selected-classes/:id', async (req, res) => { // get one selected class for payment history
     
      const id = req.params.id;
      const query = { 
        _id: new ObjectId(id) 
      }
      const result = await selectedClassCollection.findOne(query);
      res.send(result);
    })  

    app.get('/all-selected-classes', async (req, res) => { // all selected class of a student
      const email = req.query.email;
      const query = {
        userEmail: email
      }
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/my-selected-classes/:id', async (req, res) => { // delete selected classby a student
      // const email = req.query.email;
      const id = req.params.id;
      const query = { 
        _id: new ObjectId(id) 
      }
      
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    })

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    //post payment data 
    app.post('/payment-transaction/:id', verifyJWT, async (req, res) => {
      const payment = req.body;
      const id = req.params.id;
      const insertResult = await paymentCollection.insertOne(payment);

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'enrolled'
        }
      };
      const result = await selectedClassCollection.updateOne(filter, updateDoc);
      res.send(result);
      // res.send({ insertResult, deleteResult });
    }) 


    app.get('/payment-history', verifyJWT, async (req, res) => {

      const email = req.query.email;
      const query = { 
        email: email
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
      // here
    }) 


    app.get('/popular-classes', async (req, res) => {

      
      const query = { 
        total_enrolled: email
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
      // imp
    }) 




   


    /*-------------all approved classes---------
    -----------------------------------------------------*/
    app.get('/all-approved-classes', async (req, res) => {
      const query = { status: "approved" }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    // modify approved classes, modify seats
    app.patch('/all-approved-classes/seats/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };

      const classDoc = await classCollection.findOne(filter);
      const updatedSeats = parseInt(classDoc.availableSeats) - 1;

      const updateDoc = {
        $set: {
          availableSeats: updatedSeats
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })  //HERE

    app.patch('/all-approved-classes/total-enrolled/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };

      const classDoc = await classCollection.findOne(filter);
      const updatedTotal = parseInt(classDoc.total_enrolled) + 1;

      const updateDoc = {
        $set: {
          total_enrolled: updatedTotal
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })  //HERE


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