   # Hyphen Wellness - Backend API

A comprehensive gym management system backend built with Node.js, Express.js, and MongoDB.

## 🏋️‍♂️ Features

- **User Management**: Complete CRUD operations for Members, Trainers, Staff, and Admins
- **Authentication**: JWT-based authentication with role-based access control
- **Membership Management**: Handle membership plans and subscriptions
- **Payment Processing**: Track payments and billing
- **Equipment Management**: Monitor gym equipment status and maintenance
- **Class Scheduling**: Manage fitness classes and trainer assignments
- **Session Tracking**: Real-time gym session monitoring
- **Check-in/Check-out**: QR code and manual check-in system
- **Notifications**: Real-time notifications system
- **Reports**: Comprehensive analytics and reporting
- **WebSocket Support**: Real-time communication

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.io
- **Validation**: Express-validator
- **Security**: bcryptjs for password hashing

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hypgym-dubai-backend.git
   cd hypgym-dubai-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=5001
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hypgymdubaiii
   JWT_SECRET=your_jwt_secret_key_here
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm start
   ```

   For development:
   ```bash
   npm run dev
   ```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/admin/create-user` - Admin create user

### User Management
- `GET /api/members` - Get all members
- `GET /api/trainers` - Get all trainers
- `GET /api/staff` - Get all staff
- `POST /api/members` - Create new member
- `POST /api/trainers` - Create new trainer
- `POST /api/staff` - Create new staff

### Gym Operations
- `GET /api/sessions` - Get gym sessions
- `POST /api/sessions` - Create new session
- `GET /api/checkin/active` - Get active sessions
- `POST /api/checkin/checkin` - Member check-in
- `POST /api/checkin/checkout` - Member check-out

### Equipment & Classes
- `GET /api/equipment` - Get equipment list
- `POST /api/equipment` - Add new equipment
- `GET /api/classes` - Get classes
- `POST /api/classes` - Create new class

### Memberships & Payments
- `GET /api/memberships` - Get memberships
- `POST /api/memberships` - Create membership
- `GET /api/payments` - Get payments
- `POST /api/payments` - Record payment

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## 👥 User Roles

- **Admin**: Full system access
- **Trainer**: Session and class management
- **Staff**: Equipment and check-in management
- **Member**: Personal dashboard and check-in

## 🌐 WebSocket Events

- `join-room` - Join role-based room
- `session-update` - Real-time session updates
- `notification` - Send notifications

## 🚀 Deployment

### Heroku Deployment
1. Create a Heroku app
2. Set environment variables
3. Deploy:
   ```bash
   git push heroku main
   ```

### Vercel Deployment
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically

### Railway Deployment
1. Connect GitHub repository
2. Set environment variables
3. Deploy with one click

## 📊 Database Schema

### User Model
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  phone: String,
  password: String (hashed),
  role: ['admin', 'member', 'trainer', 'staff'],
  isActive: Boolean,
  specialization: String (for trainers),
  department: String (for staff)
}
```

### Gym Session Model
```javascript
{
  member: ObjectId,
  trainer: ObjectId,
  checkInTime: Date,
  checkOutTime: Date,
  duration: Number,
  notes: String
}
```

## 🔧 Development

### Project Structure
```
server/
├── models/          # Database models
├── routes/          # API routes
├── middleware/      # Custom middleware
├── index.js         # Server entry point
└── package.json     # Dependencies
```

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server
- `npm test` - Run tests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support, email support@hypgymdubai.com or create an issue in the repository.

---

**Built with ❤️ for Hyphen Wellness**













