/* Copyright 2017 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const util = require('util');
const redioactive = require('node-red-contrib-dynamorse-core').Redioactive;
const Grain = require('node-red-contrib-dynamorse-core').Grain;
const sevruga = require('sevruga');
const fs = require('fs');

function makeVideoTags(width, height, interlace, grainDuration) {
  var tags = {
    format : 'video',
    width: width,
    height: height,
    packing: 'BGRA8',
    encodingName: 'raw',
    colorimetry: 'BT709-2',
    depth: 8,
    sampling: 'RGBA-4:4:4:4',
    interlace: 1 === interlace,
    clockRate: 90000,
    grainDuration: grainDuration
  };
  return tags;
}

module.exports = function (RED) {
  var fsaccess = util.promisify(fs.access);
  var fsreadFile = util.promisify(fs.readFile);

  function svgRender (config) {
    RED.nodes.createNode(this, config);
    redioactive.Funnel.call(this, config);

    const srcDuration = [ 1, 25 ];

    function makeGrain(b, baseTime, flowId, sourceId) {
      const grainTime = Buffer.alloc(10);
      grainTime.writeUIntBE(baseTime[0], 0, 6);
      grainTime.writeUInt32BE(baseTime[1], 6);
      const grainDuration = srcDuration;
      baseTime[1] = (baseTime[1] +
        (grainDuration[0] * 1000000000 / grainDuration[1]|0))>>>0;
      baseTime[0] = (baseTime[0] + (baseTime[1] / 1000000000|0))>>>0;
      baseTime[1] = baseTime[1] % 1000000000;
      return new Grain([b], grainTime, grainTime, null,
        flowId, sourceId, grainDuration);
    }

    this.count = 0;
    this.done = 0;
    let flowID = null;
    let sourceID = null;
    const tags = makeVideoTags(+config.width, +config.height, 0, srcDuration);
    this.baseTime = [ Date.now() / 1000|0, (Date.now() % 1000) * 1000000 ];

    const svgParams = { width: +config.width, height: +config.height };
    this.log(`Opening SVG file '${config.svgFile}'`);
    fsaccess(config.svgFile, fs.R_OK)
      .then(() => fsreadFile(config.svgFile, { encoding: 'utf8' }))
      .then(svgStr => {
        this.generator((push, next) => {
          if (0 === this.count) {
            this.makeCable(
              { video: [ { tags: tags } ], backPressure: 'video[0]' });
            flowID = this.flowID();
            sourceID = this.sourceID();
          }
    
          if (this.count < +config.numPushes) {
            const renderBuf = Buffer.alloc(svgParams.width * svgParams.height * 4); // ARGB 8-bit per component
            sevruga.renderSVG(svgStr, renderBuf, svgParams)
              .then(t => {
                this.log(`Parse: ${t.parseTime}, Render: ${t.renderTime}, Total: ${t.totalTime}`);
                push(null, makeGrain(renderBuf, this.baseTime, flowID, sourceID));
                this.done++;
                if (this.count < this.done + 3)
                  setTimeout(next, 0);
              })
              .catch(push);
            this.count++;
            if (this.count < this.done + 3)
              setTimeout(next, +config.delay);
          } else {
            push(null, redioactive.end);
          }
        });
    
      })
      .catch(this.preFlightError);

    this.on('close', this.close);
  }
  util.inherits(svgRender, redioactive.Funnel);
  RED.nodes.registerType('svg-render', svgRender);
};
