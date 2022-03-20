/**
 * Uploads
 *
 * Handle file uploads
 */

/* Dependencies */
import fs from 'node:fs';
import path from 'node:path';
import fileUpload from 'express-fileupload';

import filenamify from 'filenamify';
import { unusedFilename } from 'unused-filename';
import imageSize from 'image-size';
import sharp from 'sharp';

import SaplingError from './SaplingError.js';
import Response from './Response.js';
import Utils from './Utils.js';
import Validation from './Validation.js';


/**
 * The Uploads class
 */
export default class Uploads {
	/* File categories */
	uploadTypes = {
		archive: ['application/zip', 'application/gzip', 'application/x-7z-compressed', 'application/x-bzip', 'application/x-bzip2', 'application/vnd.rar', 'application/x-rar-compressed', 'application/x-zip-compressed', 'application/x-tar'],
		image: ['image/png', 'image/jpeg', 'image/webp'],
		video: ['video/ogg', 'video/mp4', 'video/H264', 'video/mpeg', 'video/webm'],
		audio: ['audio/wav', 'audio/vnd.wave', 'audio/wave', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/aac'],
		document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
		font: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2'],
	};


	/**
	 * Initialise the Uploads class
	 *
	 * @param {object} App The App instance
	 */
	constructor(App) {
		this.app = App;

		/* Allow file uploads */
		this.app.server.use(fileUpload({
			useTempFiles: true,
		}));

		/* Ensure the upload directory exists */
		this.uploadDir = path.join(this.app.dir, this.app.config.upload.destination);

		if (!fs.existsSync(this.uploadDir)) {
			fs.mkdirSync(this.uploadDir);
		}
	}


	/**
	 * Handle any and all file uploads in a given request
	 *
	 * @param {object} request Request object
	 * @param {object} response Response object
	 * @param {object} rules Current collection model, if any
	 */
	async handleUpload(request, response, rules) {
		const data = {};

		for (const fileField of Object.keys(request.files)) {
			/* Either it's defined in a model or we don't care */
			if ((fileField in Object.keys(rules) && rules[fileField].type === 'file') || !this.app.config.strict) {
				const file = request.files[fileField];
				const rule = rules[fileField];
				const validator = new Validation();

				/* Make sure the filename is valid and available */
				const filePath = await unusedFilename(path.join(this.app.uploads.uploadDir, filenamify(file.name)));
				file.extension = file.name.split('.').slice(-1)[0];

				/* Figure out file type */
				file.group = 'other';
				for (const type of Object.keys(this.uploadTypes)) {
					if (this.uploadTypes[type].includes(file.mimetype)) {
						file.group = type;
					}
				}

				/* Special case for some archives */
				if ((file.extension === 'zip' || file.extension === 'rar') && file.mimetype === 'application/octet-stream') {
					file.group = 'archive';
				}

				/* If we have a model */
				if (rule) {
					/* Ensure the file matches the given filetype (mime, group or ext) */
					validator.validateFileType(file, fileField, rule);

					/* Ensure it's not too large */
					validator.validateFileMaxsize(file, fileField, rule);
				}

				/* Create file meta */
				const fileObject = {
					url: path.join('/', path.relative(this.app.dir, filePath)),
					filesize: file.size,
					type: file.group,
					extension: file.extension,
					mimetype: file.mimetype,
				};

				/* If it's an image */
				if (file.group === 'image') {
					/* Get the width and height */
					const dimensions = await imageSize(file.tempFilePath);
					fileObject.width = dimensions.width;
					fileObject.height = dimensions.height;

					/* Validate dimensions */
					if (rule) {
						validator.validateFileMinwidth(dimensions, fileField, rule);
						validator.validateFileMaxwidth(dimensions, fileField, rule);
						validator.validateFileMinheight(dimensions, fileField, rule);
						validator.validateFileMaxheight(dimensions, fileField, rule);
					}

					/* Generate thumbnails, if any */
					const thumbDefinition = rule && rule.thumbnails ? rule.thumbnails : this.app.config.upload.thumbnails;
					const thumbs = thumbDefinition ? new Utils().coerceArray(thumbDefinition) : [];

					for (const [i, thumb] of thumbs.entries()) {
						/* Construct path for thumbnail */
						const thumbPath = path.join(this.app.uploads.uploadDir, '/thumbs/', thumb.name || i);
						if (!fs.existsSync(thumbPath)) {
							fs.mkdirSync(thumbPath, { recursive: true });
						}

						/* Resize according to options, and save */
						await sharp(file.tempFilePath)
							.rotate() /* Rotate for EXIF orientation */
							.resize({
								width: thumb.width,
								height: thumb.height,
								fit: thumb.fit || 'cover',
							})
							.toFile(await unusedFilename(path.join(thumbPath, filenamify(file.name))));
					}
				}

				/* If there are any errors, give up */
				if (validator.errors.length > 0) {
					return new Response(this.app, request, response, new SaplingError(validator.errors));
				}

				/* Move to storage */
				await file.mv(filePath);

				data[fileField] = fileObject;
			}
		}

		return data;
	}
}
