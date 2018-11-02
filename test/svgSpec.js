/* Copyright 2018 Streampunk Media Ltd.

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

const TestUtil = require('dynamorse-test');

const svgTestNode = () => ({
  type: 'svg-render',
  z: TestUtil.testFlowId,
  name: 'svg-render-test',
  grainDuration: '1/25',
  maxBuffer: 10,
  delay: 0,
  numPushes: 10,
  width: 1920,
  height: 1080,
  wsPort: TestUtil.properties.wsPort,
  x: 100.0,
  y: 100.0,
  wires: [[]]
});

const svgNodeId = '24fde3d7.b7544c';
const spoutNodeId = 'f2186999.7e5f78';

TestUtil.nodeRedTest('A svg->spout flow is posted to Node-RED', {
  svgFilename: __dirname + '/svg/blocks.svg',
  spoutTimeout: 0
}, params => {
  var testFlow = TestUtil.testNodes.baseTestFlow();
  testFlow.nodes.push(Object.assign(svgTestNode(), {
    id: svgNodeId,
    svgFile: params.svgFilename,
    wires: [ [ spoutNodeId ] ]
  }));

  testFlow.nodes.push(Object.assign(TestUtil.testNodes.spoutTestNode(),{
    id: spoutNodeId,
    timeout: params.spoutTimeout
  }));
  return testFlow;
}, (t, params, msgObj, onEnd) => {
  // t.comment(`Message: ${JSON.stringify(msgObj)}`);
  if (msgObj.hasOwnProperty('receive')) {
    TestUtil.checkGrain(t, msgObj.receive);
  }
  else if (msgObj.hasOwnProperty('end') && (msgObj.src === 'spout')) {
    onEnd();
  }
});
