import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
    username: {
        required: true,
        type: String,
        minLength: 3,
        maxLength: 20,
        toLowerCase: true,
        unique: true,
    },
    password: {
        required: true,
        type: String,
    },
    email: {
        required: true,
        type: String,
        unique: true,
    },
    avatar: {
        type: String,
    },
    about: {
        type: String,
        minLength: 1,
        maxLength: 560,
    },
});
export const userModel = mongoose.model('user', userSchema);
