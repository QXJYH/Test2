import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

export default function handler(req, res) {
  const { filename } = req.query;
  const imagePath = join(
    'C:\\Users\\harry\\Desktop\\Revival\\ecsr\\ecsrev-main\\services\\api\\public\\images\\thumbnails',
    filename
  );

  if (!existsSync(imagePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const imageBuffer = readFileSync(imagePath);
  res.setHeader('Content-Type', 'image/png'); // Adjust based on image type
  res.send(imageBuffer);
}
