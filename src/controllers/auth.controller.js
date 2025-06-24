import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
  try {
    const { username, email, phoneNumber, password } = req.body;
    if (!username || !email || !phoneNumber || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const existing = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existing) return res.status(409).json({ message: 'User already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, phoneNumber, passwordHash });
    res.status(201).json({ id: user._id, username, email, phoneNumber });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;
    const user = await User.findOne(email ? { email } : { phoneNumber });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, phoneNumber: user.phoneNumber } });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};