import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Dental Management Server is running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
