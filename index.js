// These are just some quick extensions to supertest. More documentation and a cleanup to come.

// We provide everything supertest provides.
var supertest = require('supertest');
module.exports = supertest;

// We also use tv4 for JSON Schema validation. It's exported for others to use.
var tv4 = supertest.tv4 = require('tv4');

var defaultCredentials = false;

supertest.defaultCredentials = function (user, pass) {
	defaultCredentials = new Buffer(user + ':' + pass).toString('base64');
};

// Get the Test prototype, because we're going to enhance it! \o/
var Test = supertest.Test;

// Sets the HTTP Basic auth header.
Test.prototype.auth = function () {
	return this.set('Authorization', 'Basic ' + defaultCredentials);
};

// Send data with type form, else it would default to JSON.
Test.prototype.sendForm = function (data) {
	return this.type('form').send(data);
};

// Register a JSON schema the result has to match against.
Test.prototype.expectSchema = function (schema, e) {
	if (!this._schemas) this._schemas = [];
	this._schemas.push(schema);
	if (typeof e == 'function') this.end(e);
	return this;
};

// Extend Test's assert() method in order to do the JSON Schema tests.
(function (oldAssert) {
	Test.prototype.assert = function (res, fn) {
		var ret = oldAssert.apply(this, arguments);
		if (!this._schemas) return ret;
		for (var i = 0; i < this._schemas.length; i++) {
			if (!tv4.validate(res.body, this._schemas[i])) {
				var e = tv4.error;
				return fn(new Error(
					'schema validation failed (' + e.code + ' at ' + e.schemaPath + '): ' + e.message
				));
			}
		}
		return ret;
	};
})(Test.prototype.assert);
