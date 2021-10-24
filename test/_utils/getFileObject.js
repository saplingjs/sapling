import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mimeTypes from 'mime-types';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


export default (filename, cb) => {
	const filepath = path.join(__dirname, '../_data/files', filename);
	const file = fs.readFileSync(filepath);
	const stats = fs.statSync(filepath);
	const mime = mimeTypes.lookup(filepath);

	return {
		name: filename,
		data: file,
		size: stats.size,
		tempFilePath: filepath,
		truncated: false,
		mimetype: mime,
		mv: cb ? cb : () => true
	};
};
