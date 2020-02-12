import React, { Component } from 'react';
import Ticker from 'react-ticker';
import './App.css';

class App extends Component {

  state = {
    // articles: [],
    sources: {},
  }

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async() => {
    const raw = await fetch(`https://newsapi.org/v2/everything?domains=wsj.com,nytimes.com,cnn.com,foxnews.com&language=en&sortBy=relevancy&apiKey=${process.env.REACT_APP_INUNDATEUS_NEWS_API_KEY}`);
    const jsonData = await raw.json();
    const sources = {};
    for (const s of jsonData.articles) {
      if (!sources[s.source.id]) {
        sources[s.source.id] = { name: s.source.name, articles: [] };
      }
      sources[s.source.id].articles.push(s);
    }
    this.setState({
      sources,
    });

    console.log(jsonData);
  }

  render() {
    return (
      <div>
        {Object.keys(this.state.sources).map(key => {
          const source = this.state.sources[key];
          return (
            <div>
              <h1>{source.name}</h1>
              <Ticker offset="run-in" mode="chain" speed={25}>
                {({ index }) => (
                  <>
                    <p style={{ whiteSpace: "nowrap", display: "inline-block"}}>
                      {source.articles.map(article => {
                        return (
                          <span key={article.title} style={{ paddingRight: "4px" }}>
                            <a href={article.url}>{article.title}</a>:{" "}
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
    )
  }
}

export default App;
