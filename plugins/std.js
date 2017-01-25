var util = require("util");
var moment = require('moment');

module.exports = {
	asset: function (block, next) {
		var filename = block.expr;
		var ext = filename.substr(filename.lastIndexOf(".") + 1).toLowerCase();
		var template;

		if (ext === "css") {
			template = "<link href='%s' rel='stylesheet' type='text/css' />";
		}
		else if (ext === "js") {
			template = "<script src='%s' type='text/javascript'></script>";
		}

		//put the rendered HTML back into the view
		this.pieces.push(util.format(template, filename));
		next();
	},

	date: function (block, next) {
		try {
			var opts = block.expr.split(" ");
			var format = block.rawExpr.split(" ").slice(1).join(" ");
			
			this.pieces.push(moment(+opts[0]).format(format));
		} catch (err) {
			console.error(err, err.stack);
			this.pieces.push("Invalid Date");
		}

		next();
	},

	ago: function (block, next) {
		try {	
			this.pieces.push(moment(+block.expr).fromNow());
		} catch (err) {
			console.error(err, err.stack);
			this.pieces.push("Invalid Date");
		}

		next();
	},

	word: function (block, next) {
		var opts = block.expr.split(" ");
		var text = this.extractDots(opts[0]);
		var words = text.split(" ");

		var from = +opts[1] || 0;
		var to = +opts[2] || words.length;

		
		this.pieces.push(words.splice(from, to).join(" "));
		next();
	}
};