/**
 * Reload the whole server (get new views, config, etc)
 */
module.exports = function reload() {
	console.log(`\n\n**** RESTARTING ****\n\n`);

	/* Don't attempt to listen on the same port again */
	this.opts.listen = false;
	this.opts.reload = true;

	/* Restart the server */
	App.call(this, this.config.name, this.opts, () => {
		console.log("RESTARTED");
	});
};
