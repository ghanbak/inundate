import React, { Component } from 'react';
import './App.css';

class App extends Component {

  state = {
    articles: [],
  }

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const raw = await fetch(`https://newsapi.org/v2/everything?domains=wsj.com,nytimes.com,cnn.com,foxnews.com&language=en&sortBy=relevancy&pageSize=100&apiKey=${process.env.REACT_APP_INUNDATEUS_NEWS_API_KEY}`);
    const jsonData = await raw.json();
    this.setState({ articles: jsonData.articles });

    console.log(jsonData);
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          { this.state.articles.map(article => {
            return (
              <div key={article.title}>
                <h2><a href={article.url}>{article.title}</a></h2>
                <p>{article.source.name}</p>
              </div>
            );
          }) }
        </header>
      </div>
    );
  }
}

export default App;
