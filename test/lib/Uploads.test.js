import test from 'ava';
import path from 'path';
import fs from 'fs';
import _ from 'underscore';
import { fileURLToPath } from 'url';
import imageSize from 'image-size';

import Response from '../../lib/Response.js';
import SaplingError from '../../lib/SaplingError.js';

import getFileObject from '../_utils/getFileObject.js';

import Uploads from '../../lib/Uploads.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = _.defaults({
		dir: __dirname,
		config: {
			upload: {
				type: 'local',
				destination: 'uploads'
			},
			render: {
				driver: 'Html'
			}
		}
	}, (await import('../_utils/app.js')).default());

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test('creates upload dir', t => {
	const uploads = new Uploads(t.context.app);

	t.is(uploads.uploadDir, path.join(__dirname, 'uploads'));
	t.true(fs.existsSync(path.join(__dirname, 'uploads')));
});


test('uploads an image', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.image.url, '/uploads/image.png');
	t.is(upload.image.filesize, 1952);
	t.is(upload.image.type, 'image');
	t.is(upload.image.extension, 'png');
	t.is(upload.image.mimetype, 'image/png');
	t.is(upload.image.width, 180);
	t.is(upload.image.height, 180);
});

test('processes thumbnails', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('photo.jpg')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			thumbnails: [
				{
					name: 'web',
					width: 500,
				},
				{
					name: 'thumb',
					width: 128,
					height: 128,
					fit: 'cover',
				},
			]
		}
	});

	const thumbWebPath = path.join(__dirname, 'uploads/thumbs/web/photo.jpg');
	const thumbWebDims = await imageSize(thumbWebPath);

	t.true(fs.existsSync(thumbWebPath));
	t.is(thumbWebDims.width, 500);
	t.is(thumbWebDims.height, 375);

	const thumbThumbPath = path.join(__dirname, 'uploads/thumbs/thumb/photo.jpg');
	const thumbThumbDims = await imageSize(thumbThumbPath);

	t.true(fs.existsSync(thumbThumbPath));
	t.is(thumbThumbDims.width, 128);
	t.is(thumbThumbDims.height, 128);
});

test('uploads a video', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			video: getFileObject('video.mp4')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.video.url, '/uploads/video.mp4');
	t.is(upload.video.filesize, 103648);
	t.is(upload.video.type, 'video');
	t.is(upload.video.extension, 'mp4');
	t.is(upload.video.mimetype, 'video/mp4');
	t.false('width' in upload.video);
	t.false('height' in upload.video);
});

test('uploads an archive', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			archive: getFileObject('archive.zip')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.archive.url, '/uploads/archive.zip');
	t.is(upload.archive.filesize, 2128);
	t.is(upload.archive.type, 'archive');
	t.is(upload.archive.extension, 'zip');
	t.is(upload.archive.mimetype, 'application/zip');
	t.false('width' in upload.archive);
	t.false('height' in upload.archive);
});

test('uploads an audio', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			audio: getFileObject('audio.wav')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.audio.url, '/uploads/audio.wav');
	t.is(upload.audio.filesize, 9408);
	t.is(upload.audio.type, 'audio');
	t.is(upload.audio.extension, 'wav');
	t.is(upload.audio.mimetype, 'audio/wave');
	t.false('width' in upload.audio);
	t.false('height' in upload.audio);
});

test('uploads a document', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			document: getFileObject('document.docx')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.document.url, '/uploads/document.docx');
	t.is(upload.document.filesize, 11776);
	t.is(upload.document.type, 'document');
	t.is(upload.document.extension, 'docx');
	t.is(upload.document.mimetype, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
	t.false('width' in upload.document);
	t.false('height' in upload.document);
});

test('uploads a font', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			font: getFileObject('font.otf')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.font.url, '/uploads/font.otf');
	t.is(upload.font.filesize, 254772);
	t.is(upload.font.type, 'font');
	t.is(upload.font.extension, 'otf');
	t.is(upload.font.mimetype, 'font/otf');
	t.false('width' in upload.font);
	t.false('height' in upload.font);
});

test('uploads an unclassified file', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			other: getFileObject('other.txt')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {});

	t.is(upload.other.url, '/uploads/other.txt');
	t.is(upload.other.filesize, 12);
	t.is(upload.other.type, 'other');
	t.is(upload.other.extension, 'txt');
	t.is(upload.other.mimetype, 'text/plain');
	t.false('width' in upload.other);
	t.false('height' in upload.other);
});


test('validates a filetype by file extension', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: 'png'
		}
	});

	t.false(upload instanceof Response);
});

test('validates a filetype by file mimetype', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: 'image/png'
		}
	});

	t.false(upload instanceof Response);
});

test('validates a filetype by file group', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: 'image'
		}
	});

	t.false(upload instanceof Response);
});

test('validates a filetype by array', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: ['image', 'video']
		}
	});

	t.false(upload instanceof Response);
});


test('invalidates a filetype by file extension', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: 'txt'
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a filetype by file mimetype', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: 'image/jpg'
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a filetype by file group', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: 'archive'
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a filetype by array', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			filetype: ['archive', 'font']
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a file by filesize', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			maxsize: '32B'
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a file by min width', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			minwidth: 200
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a file by max width', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			maxwidth: 50
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a file by min height', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			minheight: 200
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('invalidates a file by max height', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	const request = _.extend({
		files: {
			image: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		image: {
			maxheight: 50
		}
	});

	t.true(upload instanceof Response);
	t.true(upload.error instanceof SaplingError);
});

test('does not process an undefined file in strict mode', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	t.context.app.config.strict = true;

	const request = _.extend({
		files: {
			photo: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		title: {
			type: 'string'
		}
	});

	t.deepEqual(upload, {});
});

test('does not process a non-file field in strict mode', async t => {
	t.context.app.uploads = new Uploads(t.context.app);
	t.context.app.config.strict = true;

	const request = _.extend({
		files: {
			title: getFileObject('image.png')
		}
	}, t.context.request);

	const upload = await t.context.app.uploads.handleUpload(request, t.context.response, {
		title: {
			type: 'string'
		}
	});

	t.deepEqual(upload, {});
});


test.after.always(t => {
	if (typeof fs.rmSync === 'function') {
		fs.rmSync(path.join(__dirname, 'uploads'), { recursive: true });
	} else {
		fs.rmdirSync(path.join(__dirname, 'uploads'), { recursive: true });
	}
});
