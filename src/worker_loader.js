/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

//JFD...
var origin_time = new Date().getTime();
var timestamp = function() {return "{" + ((new Date().getTime() - origin_time) % 600000) / 1000 + "} "};

// List of files to include;
var files = [
  'network.js',
  'core.js',
  'util.js',
  'canvas.js',
  'obj.js',
  'function.js',
  'charsets.js',
  'cidmaps.js',
  'colorspace.js',
  'crypto.js',
  'evaluator.js',
  'fonts.js',
  'glyphlist.js',
  'image.js',
  'metrics.js',
  'parser.js',
  'pattern.js',
  'stream.js',
  'chunked_stream.js',
  'pdf_manager.js',
  'worker.js',
  'jpx.js',
  'jbig2.js',
  'bidi.js',
  '../external/jpgjs/jpg.js'
];

// JFD...
//this.requestFileSystem  = this.requestFileSystemSync || this.webkitRequestFileSystemSync;
//this.fs = this.requestFileSystem(this.TEMPORARY, 1 * 1024 * 1024 * 1024);
//this.fs.sync = true;
//...JFD

// Load all the files.
for (var i = 0; i < files.length; i++) {
  importScripts(files[i]);
}
