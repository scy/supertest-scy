var sts = require("../index.js"),
    assert = require("assert"),
    restify = require("restify");

var server = restify.createServer();
server.get("/", function (req, res, next) {
	res.setHeader('Content-Type', 'application/json');
	res.send({
		foo: "bar"
	});
})

describe("the JSON Schema validation", function () {
	it("should reject JSON that doesn't match the schema", function (done) {
		var agent = sts(server);
		agent.get("/")
			.expectSchema({
				type: "object",
				required: [ "foo", "xyzzy" ]
			})
			.end(function (err) {
				assert(err, "no error occured");
				assert(err.message.match(/schema/i), "error message '" + err.message + "' does not mention schema");
				done();
			})
	});
	it("should accept JSON that matches the schema", function (done) {
		var agent = sts(server);
		agent.get("/")
			.expectSchema({
				type: "object",
				required: [ "foo" ],
				additionalProperties: false,
				properties: {
					foo: {
						type: "string"
					}
				}
			})
			.end(function (err) {
				assert(!err, "an error occured" + (err ? ": " + err.message : ""));
				done();
			})
	});
});
