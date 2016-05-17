var fs = require('fs'),
    crypto_ = require('crypto'),
    zlib = require('zlib'),
    Promise = require('bluebird');

var LibHash = function() {};

// opens the file, gzip the content and base64 encode it
LibHash.prototype.computeSubContent = function(path) {
    return new Promise(function(resolve, reject) {
        fs.readFile(path, function(err, data) {
            if (err) {
                reject(err);
            }
            zlib.deflate(data, function(err, buffer) {
                if (err) {
                    reject(err);
                }
                resolve(buffer.toString('base64'));
            });
        });
    });
};

// get md5 of a file
LibHash.prototype.computeMD5 = function(path) {
    return new Promise(function(resolve, reject) {
        var hash = crypto_.createHash('md5'),
            stream = fs.createReadStream(path);

        stream.on('data', function(data) {
            hash.update(data, 'utf8');
        }).on('end', function() {
            resolve(hash.digest('hex')); // md5 checksum
        }).on('error', function(err) {
            reject(err);
        });
    });
};

LibHash.prototype.computeHash = function(path) {
    // based on node-opensubtitles-api, under MIT - Copyright (c) 2015 ka2er

    var self = this;

    return new Promise(function(resolve, reject) {
        // get file size, first 64kb, last 64kb and summup everything
        var chunk_size = 65536, //64 * 1024
            buf_start = new Buffer(chunk_size * 2),
            buf_end = new Buffer(chunk_size * 2),
            file_size = 0,
            array_checksum = [];

        function checksumReady(checksum_part) {
            array_checksum.push(checksum_part);
            if (array_checksum.length === 3) {
                var checksum = self.sumHex64bits(array_checksum[0], array_checksum[1]);
                checksum = self.sumHex64bits(checksum, array_checksum[2]);
                checksum = checksum.substr(-16);
                resolve({
                    moviehash: self.padLeft(checksum, '0', 16),
                    moviebytesize: file_size.toString()
                });
            }
        }

        fs.stat(path, function(err, stat) {
            if (err) {
                return reject(err);
            }

            file_size = stat.size;

            checksumReady(file_size.toString(16));

            fs.open(path, 'r', function(err, fd) {
                if (err) {
                    return reject(err);
                }

                var array_buffers = [{
                    buf: buf_start,
                    offset: 0
                }, {
                    buf: buf_end,
                    offset: file_size - chunk_size
                }];
                for (var i in array_buffers) {
                    j = 0;
                    fs.read(fd, array_buffers[i].buf, 0, chunk_size * 2, array_buffers[i].offset, function(err, bytesRead, buffer) {
                        if (err) {
                            return reject(err);
                        }
                        checksumReady(self.checksumBuffer(buffer, 16));
                        j++;
                        if (j == array_buffers.length) {
                            fs.close(fd);
                        }
                    });
                }
            });
        });
    });
};

// read 64 bits from buffer starting at offset as LITTLE ENDIAN hex
LibHash.prototype.read64LE = function(buffer, offset) {
    var ret_64_be = buffer.toString('hex', offset * 8, ((offset + 1) * 8));
    var array = [];
    for (var i = 0; i < 8; i++) {
        array.push(ret_64_be.substr(i * 2, 2));
    }
    array.reverse();
    return array.join('');
};

// compute checksum of the buffer splitting by chunk of lengths bits
LibHash.prototype.checksumBuffer = function(buf, length) {
    var checksum = 0,
        checksum_hex = 0;
    for (var i = 0; i < (buf.length / length); i++) {
        checksum_hex = this.read64LE(buf, i);
        checksum = this.sumHex64bits(checksum.toString(), checksum_hex).substr(-16);
    }
    return checksum;
};

// calculate hex sum between 2 64bits hex numbers
LibHash.prototype.sumHex64bits = function(n1, n2) {
    if (n1.length < 16) {
        n1 = this.padLeft(n1, '0', 16);
    }
    if (n2.length < 16) {
        n2 = this.padLeft(n2, '0', 16);
    }

    // 1st 32 bits
    var n1_0 = n1.substr(0, 8);
    var n2_0 = n2.substr(0, 8);
    var i_0 = parseInt(n1_0, 16) + parseInt(n2_0, 16);

    // 2nd 32 bits
    var n1_1 = n1.substr(8, 8);
    var n2_1 = n2.substr(8, 8);
    var i_1 = parseInt(n1_1, 16) + parseInt(n2_1, 16);

    // back to hex
    var h_1 = i_1.toString(16);
    var i_1_over = 0;
    if (h_1.length > 8) {
        i_1_over = parseInt(h_1.substr(0, h_1.length - 8), 16);
    } else {
        h_1 = this.padLeft(h_1, '0', 8);
    }

    var h_0 = (i_1_over + i_0).toString(16);

    return h_0 + h_1.substr(-8);
};

// pad left with c up to length characters
LibHash.prototype.padLeft = function(str, c, length) {
    while (str.length < length) {
        str = c.toString() + str;
    }
    return str;
};

module.exports = new LibHash();