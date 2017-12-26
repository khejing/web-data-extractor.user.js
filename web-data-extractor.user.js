// ==UserScript==
// @name         Web Data Extractor
// @namespace    https://github.com/khejing/web-data-extractor.user.js
// @version      0.1
// @description  A universal web data extractor
// @author       Will Lee
// @match        https://mp.weixin.qq.com/cgi-bin/home*
// @grant        GM_getResourceText
// @resource     sugar              https://cdn.bootcss.com/sugar/2.0.0/sugar.min.js
// @resource     sugar-locale-zh    https://cdn.bootcss.com/sugar/2.0.0/locales/zh-cn.min.js
// @require      https://cdn.bootcss.com/URI.js/1.19.0/URI.min.js
// @require      https://cdn.bootcss.com/bluebird/3.5.1/bluebird.min.js
// @require      https://cdn.bootcss.com/lodash.js/4.17.4/lodash.min.js
// ==/UserScript==

'use strict';

async function evalScript(text) {
  eval(`(function(){
    ${text}
  }).call(window)`);
}

(function() {
  const sugarScript = GM_getResourceText('sugar');
  evalScript(sugarScript);
  const sugarLocaleScript = GM_getResourceText('sugar-locale-zh');
  eval(sugarLocaleScript);

  const buttonClass = 'weui-desktop-btn weui-desktop-btn_primary';
  const disabledButtonClass = buttonClass + ' weui-desktop-btn_disabled';
  const loadingButtonClass = buttonClass + ' weui-desktop-btn_loading';
  const title = document.querySelector('#list_container .weui-desktop-panel__title');
  const header = document.querySelector('#list_container .weui-desktop-panel__hd');
  let ele = document.createElement('div');
  header.insertBefore(ele, title);
  ele.outerHTML = `<div id="actions" style="float: right;">
                    <button id="startCrawl" class="${buttonClass}">开始抓取</button>
                    <button id="stopCrawl" class="${buttonClass}">停止</button>
                  </div>`;

  let stop;
  Sugar.Date.setLocale('zh-CN');
  const startButton = document.getElementById('startCrawl');
  startButton.addEventListener('click', async () => {
    let download = document.getElementById('download');
    if (download) {
      download.remove();
    }
    stop = false;
    startButton.setAttribute('class', disabledButtonClass);
    startButton.disabled = true;
    const data = {};
    while (true) {
      for (let li of document.querySelectorAll('li.weui-desktop-mass__item')) {
        const dateElement = li.querySelector('.weui-desktop-mass__time');
        let sugarRawDate = new Sugar.Date(Sugar.Date.create(dateElement.innerText));
        if (sugarRawDate.isAfter(new Sugar.Date()).raw) {
          sugarRawDate = sugarRawDate.rewind('7 days');
        }
        const date = sugarRawDate.short().raw;
        const articleElements = li.querySelectorAll('div.weui-desktop-mass-appmsg__bd');
        for (let articleElement of articleElements) {
          const linkElement = articleElement.querySelector('a.weui-desktop-mass-appmsg__title');
          if (linkElement) {
            const link = linkElement.getAttribute('href');
            const title = linkElement.lastChild.wholeText.trim();
            const readNumElement = articleElement.querySelector('.weui-desktop-mass-media__data__inner');
            const readNum = readNumElement.innerText;
            const uri = new URI(link);
            const query = URI.parseQuery(uri.search());
            data[query.chksm] = [title, readNum, date, link];
          }
        }
      }
      const nextPage = document.querySelector('a.weui-desktop-btn.weui-desktop-btn_default.weui-desktop-btn_mini:last-child');
      if (nextPage && !stop) {
        nextPage.click();
        await Promise.delay(3000);
      } else {
        break;
      }
    }
    const sortedArticles = _.reverse(_.sortBy(Object.values(data), row => row[2]));
    const csvData = ['\ufeff'];
    const columns = ['标题', '阅读数', '发布日期', 'URL'];
    const newline = '\n';
    const delimiter = ',';
    csvData.push(columns.join(delimiter) + newline);
    for (let article of sortedArticles) {
      csvData.push(article
        .map(e => '"' + e.replace(/"/g, '""').trim() + '"')
        .join(delimiter) + newline);
    }
    const blob = new Blob(csvData, {type: 'text/csv'});
    ele = document.getElementById('actions');
    download = document.createElement('a');
    ele.appendChild(download);
    download.outerHTML = `<a
      id="download" href="${window.URL.createObjectURL(blob)}"
      download="微信数据.csv">下载数据</a>`;
    startButton.setAttribute('class', buttonClass);
    startButton.disabled = false;
    stopButton.setAttribute('class', buttonClass);
  });
  const stopButton = document.getElementById('stopCrawl');
  stopButton.addEventListener('click', () => {
    if (!stop) {
      stop = true;
      stopButton.setAttribute('class', loadingButtonClass);
    }
  })
})();
