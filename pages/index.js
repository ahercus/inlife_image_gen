import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/scripts.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
        document.body.removeChild(script);
    };
  }, []);


  return (
    <>
       <Head>
        <title>Vision Board Generator</title>
        <link rel="stylesheet" href="/styles.css" />
       </Head>
       <div className="container">
          <h1>Vision Board Generator</h1>
          <textarea id="visionPrompt" placeholder="Enter your vision board prompt"></textarea>
          <button id="generateButton">Generate Prompts</button>
           <div id="resultsContainer"></div>
      </div>
    </>
  );
}