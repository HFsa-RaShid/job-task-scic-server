const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
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

    // JWT token generation function
    function generateToken(user) {
      return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });
    }

    // Endpoint for user registration
    // app.post('/register', async (req, res) => {
    //   const { name, email, pin, mobile, role } = req.body;
    
    //   // Check if the user already exists
    //   const existingUser = await usersCollection.findOne({ email });
    //   if (existingUser) {
    //     return res.status(400).send({ message: 'User already exists' });
    //   }
    
    //   const hashedPin = await bcrypt.hash(pin, 10);
    //   console.log('Hashed PIN during registration:', hashedPin);
    
    //   const newUser = {
    //     name,
    //     email,
    //     pin: hashedPin,
    //     mobile,
    //     role,
    //     createdAt: new Date()
    //   };
    
    //   const result = await usersCollection.insertOne(newUser);
    //   const token = generateToken(newUser);
    //   res.send({ token, user: newUser });
    // });

    app.post('/register', async (req, res) => {
      const { name, email, pin, mobile, role } = req.body;
    
      try {
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(400).send({ message: 'User already exists' });
        }
    
        const hashedPin = await bcrypt.hash(pin, 10);
        // console.log('Hashed PIN during registration:', hashedPin);
    
        const newUser = {
          name,
          email,
          pin: hashedPin,
          mobile,
          role,
          createdAt: new Date()
        };
    
        const result = await usersCollection.insertOne(newUser);
    
        const token = generateToken(newUser);
        res.status(201).send({ token, user: newUser });
      } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send({ message: 'Registration failed' });
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
     
    //     const { email, pin } = req.body;
    //     const user = await usersCollection.findOne({ email });
    //     if (!user) {
    //       return res.status(404).send({ message: 'User not found' });
    //     }

    //     // Log PINs for debugging
    //     console.log('User provided PIN:', pin);
    //     console.log('Hashed PIN in database:', user.pin);

    //     // Compare PIN
    //     const isMatch = await bcrypt.compare(pin, user.pin);
    //     console.log('PIN match result:', isMatch);
    //     if (!isMatch) {
    //       return res.status(401).send({ message: 'Invalid credentials' });
    //     }

    //     // Generate JWT token
    //     const token = generateToken(user);
    //     res.send({ token, user });
      
    // });

    
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
