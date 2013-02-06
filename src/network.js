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

// NOTE: Be careful what goes in this file, as it is also used from the context
// of the addon. So using warn/error in here will break the addon.

'use strict';


//#if (FIREFOX || MOZCENTRAL)
//
//Components.utils.import('resource://gre/modules/Services.jsm');
//
//var EXPORTED_SYMBOLS = ['NetworkManager'];
//
//function log(aMsg) {
//  var msg = 'network.js: ' + (aMsg.join ? aMsg.join('') : aMsg);
//  Services.console.logStringMessage(msg);
//  // dump() doesn't seem to work here...
//  dump(msg + '\n');
//}
//#else
function log(aMsg) {
  console.log(aMsg);
}
//#endif

var NetworkManager = (function NetworkManagerClosure() {
  function NetworkManager(url, args) {
    this.url = url;
    args = args || {};
    this.httpHeaders = args.httpHeaders || {};
    this.getXhr = args.getXhr ||
      function NetworkManager_getXhr() {
        return new XMLHttpRequest();
      };

    this.currXhrId = 0;
    this.pendingRequests = {};
    this.loadedRequests = {};
  }

  function getArrayBuffer(xhr) {
    var data = (xhr.mozResponseArrayBuffer || xhr.mozResponse ||
                xhr.responseArrayBuffer || xhr.response);
    if (typeof data !== 'string') {
      return data;
    }
    var length = data.length;
    var buffer = new Uint8Array(length);
    for (var i = 0; i < length; i++) {
      buffer[i] = data.charCodeAt(i) & 0xFF;
    }
    return buffer;
  }

  // TODO(mack): support onprogress during range request
  NetworkManager.prototype = {
    requestRange: function NetworkManager_requestRange(begin, end, callback) {
      return this.request({
        begin: begin,
        end: end,
        onDone: callback
      });
    },

    requestFull: function NetworkManager_requestRange(args) {
      return this.request(args);
    },

    request: function NetworkManager_requestRange(args) {
      var xhr = this.getXhr();
      var xhrId = this.currXhrId++;
      this.pendingRequests[xhrId] = xhr;

      xhr.open('GET', this.url);
      for (var property in this.httpHeaders) {
        var value = this.httpHeaders[property];
        if (typeof value === 'undefined') {
          continue;
        }
        xhr.setRequestHeader(property, value);
      }
      if ('begin' in args && 'end' in args) {
        var rangeStr = args.begin + '-' + (args.end - 1);
        xhr.setRequestHeader('Range', 'bytes=' + rangeStr);
        xhr.expectedStatus = 206;
      } else {
        xhr.expectedStatus = 200;
      }

      xhr.mozResponseType = xhr.responseType = 'arraybuffer';

      // TODO(mack): Support onprogress
      xhr.onprogress = function(evt) {
      };

      // TODO(mack): Support onerror
      xhr.onerror = function(evt) {
        //error('Received onerror');
      };

      xhr.onreadystatechange = this.onStateChange.bind(this, xhrId);

      xhr.onHeadersReceived = args.onHeadersReceived;
      xhr.onDone = args.onDone;

      xhr.send(null);

      return xhrId;
    },

    onStateChange: function NetworkManager_onStateChange(xhrId, evt) {
      var xhr = this.pendingRequests[xhrId];
      if (!xhr) {
        // Maybe abortRequest was called...
        return;
      }

      if (xhr.readyState >= 2 && xhr.onHeadersReceived) {
        xhr.onHeadersReceived();
        delete xhr.onHeadersReceived;
      }

      if (xhr.readyState !== 4) {
        return;
      }

      if (!(xhrId in this.pendingRequests)) {
        // The XHR request might have been aborted in onHeadersReceived()
        // callback, in which case we should abort request
        return;
      }

      delete this.pendingRequests[xhrId];

      if (xhr.status === 0) {
        //warn('Received xhr.status of 0');
        return;
      }

      // TODO(mack): Support error callback
      // This could be a 200 response to indicate that range requests are not
      // supported
      if (xhr.status !== xhr.expectedStatus) {
        //warn('Received xhr.status of ' + xhr.status);
        return;
      }

      this.loadedRequests[xhrId] = true;

      var chunk = getArrayBuffer(xhr);
      if (xhr.expectedStatus === 206) {
        var rangeHeader = xhr.getResponseHeader('Content-Range');
        var matches = /bytes (\d+)-(\d+)\/(\d+)/.exec(rangeHeader);
        var begin = parseInt(matches[1], 10);
        var end = parseInt(matches[2], 10) + 1;
        var totalLength = parseInt(matches[3], 10);
        xhr.onDone({
          begin: begin,
          end: end,
          chunk: chunk,
          totalLength: totalLength
        });
      } else {
        xhr.onDone({
          chunk: chunk,
          totalLength: chunk.byteLength
        });
      }
    },

    hasPendingRequests: function NetworkManager_hasPendingRequests() {
      for (var xhrId in this.pendingRequests) {
        return true;
      }
      return false;
    },

    getRequestXhr: function NetworkManager_getXhr(xhrId) {
      return this.pendingRequests[xhrId];
    },

    isPendingRequest: function NetworkManager_isPendingRequest(xhrId) {
      return xhrId in this.pendingRequests;
    },

    isLoadedRequest: function NetworkManager_isLoadedRequest(xhrId) {
      return xhrId in this.loadedRequests;
    },

    abortXhrs: function NetworkManager_abortXhrs() {
      for (var xhrId in this.pendingRequests) {
        xhrId = xhrId | 0;
        var xhr = this.pendingRequests[xhrId];
        delete this.pendingRequests[xhrId];
        xhr.abort();
      }
    },

    abortRequest: function NetworkManager_abortRequest(xhrId) {
      var xhr = this.pendingRequests[xhrId];
      delete this.pendingRequests[xhrId];
      xhr.abort();
    }
  };

  return NetworkManager;
})();

