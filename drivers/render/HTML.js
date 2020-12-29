/**
 * HTML driver for Sapling
 *
 * A simple fallback render driver that just loads the HTML files
 * its given.
 */


/* Dependencies */
const fs = require('fs');
const path = require('path');
const _ = require('underscore');
const Interface = require('./Interface');

const SaplingError = require('../../lib/SaplingError');
const { console } = require('../../lib/Cluster');


module.exports = class HTML extends Interface {
	/**
	 * Initialise HTML
	 */
	constructor(App, viewsPath) {
		super();
		this.app = App;
		this.viewsPath = viewsPath;
	}


	/**
	 * Render a template file
	 *
	 * @param {string} template Path of the template file being rendered, relative to root
	 * @param {object} data Object of data to pass to the template
	 */
	async render(template, data) {
		/* Read the template file */
		let html = '';
		try {
			html = fs.readFileSync(path.resolve(this.viewsPath, template), 'utf8');
		} catch (error) {
			new SaplingError(error);
		}

		/* Do some rudimentary var replacement */
		html = html.replace(/{{ ?([\w.]+) ?(?:\| ?safe ?)?}}/gi, (tag, identifier) => {
			/* Return either matching data, or the tag literal */
			return _.get(data, identifier, tag);
		});

		return html;
	}


	/**
	 * Register custom tags with the template engine
	 */
	registerTags() {
		return true;
	}
};
