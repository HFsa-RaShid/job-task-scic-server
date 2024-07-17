const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aq8mwv9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();
    const database = client.db('job-task');
    const usersCollection = database.collection('users');
    const pendingUsersCollection = database.collection('pendingUser');
    const cashInRequestsCollection = database.collection('cashInRequest')

    // JWT token generation function
    function generateToken(user) {
      return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });
    }


    app.get('/user', authenticateToken, async (req, res) => {
     
        const userId = req.user.id;
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        // Return user data
        res.send({ user });
      
    });

    

    // app.post('/register', async (req, res) => {
    //   const { name, email, pin, mobile, role } = req.body;
    
    //   try {
    //     const existingUser = await usersCollection.findOne({ email });
    //     if (existingUser) {
    //       return res.status(400).send({ message: 'User already exists' });
    //     }
    
    //     const hashedPin = await bcrypt.hash(pin, 10);
    //     // console.log('Hashed PIN during registration:', hashedPin);
    
    //     const newUser = {
    //       name,
    //       email,
    //       pin: hashedPin,
    //       mobile,
    //       role,
    //       createdAt: new Date()
    //     };
    
    //     const result = await usersCollection.insertOne(newUser);
    
    //     const token = generateToken(newUser);
    //     res.status(201).send({ token, user: newUser });
    //   } catch (error) {
    //     console.error('Registration error:', error);
    //     res.status(500).send({ message: 'Registration failed' });
    //   }
    // });


    app.post('/register', async (req, res) => {
      const { name, email, pin, mobile, role } = req.body;
    
      try {
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).send({ message: 'User already exists' });
        }
    
        const existingPendingUser = await pendingUsersCollection.findOne({ email });
        if (existingPendingUser) {
          return res.status(400).send({ message: 'Registration pending approval' });
        }
    
        const hashedPin = await bcrypt.hash(pin, 10);
        const pendingUser = {
          name,
          email,
          pin: hashedPin,
          mobile,
          role,
          status: 'pending',
          createdAt: new Date()
        };
    
        await pendingUsersCollection.insertOne(pendingUser);
    
        res.status(201).send({ message: 'Registration submitted, pending approval' });
      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send({ message: 'Registration failed' });
      }
    });

    app.get('/pending-users', async (req, res) => {
      try {
        const pendingUsers = await pendingUsersCollection.find({ status: 'pending' }).toArray();
        res.status(200).send(pendingUsers);
      } catch (error) {
        // console.error('Error fetching pending users:', error);
        res.status(500).send({ message: 'Failed to fetch pending users' });
      }
    });
    

    app.post('/approve-user', async (req, res) => {
      const { userId } = req.body;
    
      try {
        const user = await pendingUsersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }
    
        let balanceToAdd = 0;
        if (user.role === 'user') {
          balanceToAdd = 40;
        } else if (user.role === 'agent') {
          balanceToAdd = 10000;
        }
    
        const approvedUser = { ...user, status: 'approved', balance: balanceToAdd };
        await usersCollection.insertOne(approvedUser);
        await pendingUsersCollection.deleteOne({ _id: new ObjectId(userId) });
    
        res.status(200).send({ message: 'User approved successfully', user: approvedUser });
      } catch (error) {
        console.error('Error approving user:', error);
        res.status(500).send({ message: 'Approval failed' });
      }
    });
    
    

    
    //  user login
    app.post('/login', async (req, res) => {
      const { email, pin } = req.body;

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }
    
        const isMatch = await bcrypt.compare(pin, user.pin);
        // console.log('User provided PIN:', pin);
        // console.log('Hashed PIN in database:', user.pin);
        // console.log('PIN match result:', isMatch);
    
        if (!isMatch) {
          return res.status(401).send({ message: 'Invalid credentials' });
        }
    
        const token = generateToken(user);
        res.send({ token, user });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).send({ message: 'Login failed' });
      }
   
    });


    app.get('/agents', authenticateToken, async (req, res) => {
        const agents = await usersCollection.find({ role: 'agent' }).toArray();
        res.send(agents);
    });

   
    app.post('/cash-in-request', authenticateToken, async (req, res) => {
      const { userId, agentId, amount } = req.body;
      try {
        const cashInRequest = {
          userId: new ObjectId(userId),
          agentId: new ObjectId(agentId),
          amount,
          status: 'pending',
          createdAt: new Date()
        };

        await cashInRequestsCollection.insertOne(cashInRequest);
        res.status(201).send({success: true, message: 'Cash-in request submitted, pending approval'});
      } catch (error) {
        console.error('Cash-in request error:', error);
        res.status(500).send({ message: 'Cash-in request failed' });
      }
    });
   

    
    


    app.get('/profile', authenticateToken, (req, res) => {
      res.status(200).send(req.user); 
    });

    // Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  } finally {
    // Ensure that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Running');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
