import express from 'express';
import bodyParser from 'body-parser';
import { createReadStream } from 'fs';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { MongoClient } from 'mongodb';
import pug from 'pug';
import appFactory from './app.js';

const PORT = process.env.PORT || 3567;

const app = appFactory(
    express,
    bodyParser,
    createReadStream,
    crypto,
    http,
    MongoClient,
    pug
);

app.listen(PORT, () => {
    console.log(`Express server running on http://localhost:${PORT}`);
});