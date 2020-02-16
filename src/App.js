import React, { Component } from 'react';
import Ticker from 'react-ticker';
import './App.css';

class App extends Component {
  state = {
    sources: {}
  };

  componentDidMount() {
    this.fetchData();
  }

  ShowCurrentDate = () => {
    var currentDate =
      new Date().getFullYear() +
      "-" +
      (new Date().getMonth() + 1) +
      "-" +
      new Date().getDate();

    return currentDate;
  };

  fetchData = async () => {
    const raw = await fetch(
      `https://newsapi.org/v2/everything?domains=wsj.com,nytimes.com,cnn.com,foxnews.com&from=${this.ShowCurrentDate()}&language=en&sortBy=publishedAt&pageSize=100&apiKey=${process.env.REACT_APP_INUNDATEUS_NEWS_API_KEY}`
    );
    const jsonData = await raw.json();
    const sources = {};
    for (const s of jsonData.articles) {
      if (!sources[s.source.id]) {
        sources[s.source.id] = { name: s.source.name, articles: [] };
      }
      sources[s.source.id].articles.push(s);
    }
    this.setState({
      sources
    });

    console.log(this.ShowCurrentDate());
    console.log(jsonData);
  };

  randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  render() {
    return (
      <div>
        {Object.keys(this.state.sources).map(key => {
          const source = this.state.sources[key];
          return (
            <div key={source.name}>
              <h1>{source.name}</h1>
              <Ticker
                offset={this.randomInteger(0, 1024)}
                mode="chain"
                speed={this.randomInteger(25, 40)}
              >
                {({ index }) => (
                  <>
                    <p
                      style={{ whiteSpace: "nowrap", display: "inline-block" }}
                    >
                      {source.articles.map(article => {
                        return (
                          <span
                            key={`${article.title}-${article.id}`}
                            style={{ paddingRight: "4px" }}
                          >
                            <a href={article.url}>{article.title}:</a>{" "}
                            {article.description}
                          </span>
                        );
                      })}
                    </p>
                  </>
                )}
              </Ticker>
            </div>
          );
        })}
      </div>
    );
  }
}

export default App;
