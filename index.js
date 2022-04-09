import prompts from 'prompts';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer'
import fs from 'fs';
import { promisify } from 'util';

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

const acceptUrl = async () => {
    const { url } = await prompts({
        type: 'text',
        name: 'url',
        message: 'Enter an article URL to parse',
        validate: value => {
            const errorMessage = 'Please enter a valid Business Insider article URL'
            try {
                return new URL(value).hostname.endsWith('businessinsider.com') || errorMessage;
            } catch (err) {
                return errorMessage;
            }
        }
    });
    return url;
}

const fetchArticleTitleAndHtml = async ({ url }) => {
    const { data: pageHtml } = await axios.get(url);
    const { window: { document } } = new JSDOM(pageHtml);
    const articleTitle = document.title;
    const articleContainer = document.querySelector('#l-content article');
    if (!articleContainer) {
        throw new Error('Could not find the article on the page');
    }
    const aspectRatio = articleContainer.querySelector('.aspect-ratio');
    aspectRatio.setAttribute('style', '');
    const moreContentContainer = articleContainer.querySelector('.post-content-more');
    const notificationPromptContainer = articleContainer.querySelector('.notification-prompt-wrapper');
    const popularVideoContainer = articleContainer.querySelector('.popular-video');
    const postContentContainer = articleContainer.querySelector('.post-content-category');
    const postContentBottomContainer = articleContainer.querySelector('.post-content-bottom');
    const elsToRemove = [
        moreContentContainer,
        notificationPromptContainer,
        popularVideoContainer,
        postContentContainer,
        postContentBottomContainer
    ].filter(Boolean);
    for (const el of elsToRemove) {
        el.remove();
    }
    const refreshPlayer = document.querySelector('.the-refresh-player-wrapper');
    if (refreshPlayer) {
        refreshPlayer.remove();
    }
    const articleHtml = articleContainer.innerHTML;
    return { articleTitle, articleHtml };
}

const generateTitle = ({ articleTitle }) => {
    const title = `${articleTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    return title;
}

const generatePdf = async ({ articleTitle, articleHtml }) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(articleHtml);
    if (!(await exists('articles'))) {
        await mkdir('articles');
    }
    const path = `articles/${generateTitle({ articleTitle })}`;
    await page.pdf({
        path,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
        }
    });
    await browser.close();
    return path;
}

const generateArticlePdf = async () => {
    const start = Date.now();
    const url = await acceptUrl();
    const { articleTitle, articleHtml } = await fetchArticleTitleAndHtml({ url });
    const path = await generatePdf({ articleTitle, articleHtml });
    const finish = Date.now();
    const timeToComplete = (finish - start) / 1000;
    console.log(`[${timeToComplete}s]: Article saved to ${path}`);
}

(async () => {
    await generateArticlePdf();
})();

export default generateArticlePdf;