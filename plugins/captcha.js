var API_SERVER = "//www.google.com/recaptcha/api";
var API_SECURE_SERVER = "https://www.google.com/recaptcha/api";
var VERIFY_SERVER = "www.google.com";

exports.captcha = function (block, next) {
	var input = block.expr.split(" ");
    var key = input[0];
    var error = input[1] || "";
    if (error) error = "&error=" + error;

	var html = '<script type="text/javascript" src="'+ API_SERVER +'/challenge?k=' + key + error + '"></script>\
        <noscript>\
                <iframe src="' + API_SERVER + '/noscript?k=' + key + error + '" height="300" width="500" frameborder="0"></iframe><br/>\
                <textarea name="recaptcha_challenge_field" rows="3" cols="40"></textarea>\
                <input type="hidden" name="recaptcha_response_field" value="manual_challenge"/>\
        </noscript>';

    console.log("CAPTCHA STUFF", key);
    this.pieces.push(html);
	next();
};