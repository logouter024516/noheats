import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xmlToJson } from '../xml-simple.mjs';

test('nested elements and text values', () => {
  const xml = `<ServiceResult><msgHeader><code>0</code><msg>NORMAL_SERVICE</msg></msgHeader></ServiceResult>`;
  assert.deepEqual(xmlToJson(xml), {
    ServiceResult: { msgHeader: { code: '0', msg: 'NORMAL_SERVICE' } },
  });
});

test('repeated siblings become arrays', () => {
  const xml = `<msgBody><itemList><pathInfoList><pathInfo><routeNm>4호선</routeNm></pathInfo><pathInfo><routeNm>2호선</routeNm></pathInfo></pathInfoList></itemList></msgBody>`;
  assert.deepEqual(xmlToJson(xml), {
    msgBody: {
      itemList: {
        pathInfoList: { pathInfo: [{ routeNm: '4호선' }, { routeNm: '2호선' }] },
      },
    },
  });
});

test('repeated itemList (multiple routes) becomes array', () => {
  const xml = `<msgBody><itemList><time>1800</time></itemList><itemList><time>2400</time></itemList></msgBody>`;
  assert.deepEqual(xmlToJson(xml).msgBody.itemList, [{ time: '1800' }, { time: '2400' }]);
});

test('self-closing and empty tags', () => {
  const xml = `<pathInfo><railLinkList/><routeNm>4호선</routeNm></pathInfo>`;
  assert.deepEqual(xmlToJson(xml), { pathInfo: { railLinkList: '', routeNm: '4호선' } });
});

test('xml declaration + CDATA + comments are dropped', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><!-- comment --><root><![CDATA[서울특별시]]><sub>강남</sub></root>`;
  assert.deepEqual(xmlToJson(xml), { root: { sub: '강남' } });
});

test('unmatched close is tolerated', () => {
  const xml = `<a><b>1</b></x></a>`;
  assert.deepEqual(xmlToJson(xml), { a: { b: '1' } });
});

test('single items inside repeated nodes stay objects', () => {
  const xml = `<msgBody><itemList><time>1800</time><pathInfoList><pathInfo><routeNm>4호선</routeNm></pathInfo></pathInfoList></itemList></msgBody>`;
  const out = xmlToJson(xml);
  assert.equal(Array.isArray(out.msgBody.itemList), false);
  assert.equal(Array.isArray(out.msgBody.itemList.pathInfoList.pathInfo), false);
  assert.equal(out.msgBody.itemList.pathInfoList.pathInfo.routeNm, '4호선');
});