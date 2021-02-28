/**
 * Uploads
 *
 * Handle file uploads
 */

'use strict';


/* Dependencies */
const fs = require('fs');
const path = require('path');
const fileUpload = require('express-fileupload');

const filenamify = require('filenamify');
const unusedFilename = require('unused-filename');
const imageSize = require('image-size');

const SaplingError = require('./SaplingError');
const Response = require('./Response');
const Validation = require('./Validation');


/**
 * The Uploads class
 */
module.exports = class Uploads {
	/* File categories */
	uploadTypes = {
		archive: ['application/zip', 'application/gzip', 'application/x-7z-compressed', 'application/x-bzip', 'application/x-bzip2', 'application/vnd.rar', 'application/x-tar'],
		image: ['image/png', 'image/jpeg', 'image/webp'],
		video: ['video/ogg', 'video/mp4', 'video/H264', 'video/mpeg', 'video/webm'],
		audio: ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/aac'],
		document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
		font: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2']
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
			useTempFiles: true
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
					mimetype: file.mimetype
				};

				/* If it's an image, get the width and height */
				if (file.group === 'image') {
					const dimensions = await imageSize(file.tempFilePath);
					fileObject.width = dimensions.width;
					fileObject.height = dimensions.height;

					/* Validate dimensions */
					if (rule) {
						validator.validateFileMinwidth(dimensions, fileField, rule);
						validator.validateFileMaxwidth(dimensions, fileField, rule);
						validator.validateFileMinheight(dimensions, fileField, rule);
						validator.validateFileMinheight(dimensions, fileField, rule);
					}
				}

				/* If there are any errors, give up */
				if (validator.errors.length > 0) {
					new Response(this.app, request, response, new SaplingError(validator.errors));
					return false;
				}

				/* Move to storage */
				await file.mv(filePath);

				data[fileField] = fileObject;
			}
		}

		return data;
	}
};