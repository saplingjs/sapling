function Error (err) {
	this.template = {"errors":[]};

	this.parse(err);
}

Error.prototype = {
	parse: function (err) {
		if (typeof err === "string") {
			this.template.errors.push({
				title: err
			});
		} else if (Array.isArray(err)) {
			for (var i = 0; i < err.length; ++i) {
				this.parse(err[i]);
			}
		} else if (typeof err === "object") {
			this.template.errors.push(err);
		}
	},

	toJSON: function () {
		return JSON.stringify(this.template);
	}
};

module.exports = Error;