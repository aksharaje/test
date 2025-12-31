# Embedding Generator

## Overview
The Embedding Generator helps Product Managers analyze and extract meaningful insights from text data. By generating embeddings, PMs can enhance their understanding of customer feedback, market trends, and sentiment analysis.

## Key Capabilities
- Generate embeddings for a list of texts
- Split text into chunks for detailed analysis
- Estimate token count for text data
- Generate a single embedding for a query

## How to Use
To leverage the Embedding Generator, start by inputting the text data you want to analyze. Use the 'Split Text into Chunks' function to break down lengthy text for comprehensive examination. Then, generate embeddings for the text to extract valuable insights. If you have a specific query, use the 'Generate Query Embedding' feature to obtain a single embedding for quick analysis.

## Configuration & Fields
- **Text**: Input the text data you want to analyze.
  - **Purpose**: Provides content for generating embeddings.
  - **Example**: Customer feedback from the latest survey.
  
- **Chunk Size**: Specify the size of each text chunk.
  - **Purpose**: Controls the granularity of text analysis.
  - **Example**: 100 characters per chunk.
  
- **Chunk Overlap**: Define the overlap between consecutive text chunks.
  - **Purpose**: Ensures continuity in the analysis.
  - **Example**: 20 characters overlap.
  
- **Model**: Choose the embedding model to use for analysis.
  - **Purpose**: Influences the quality of generated embeddings.
  - **Example**: BERT-based model.
  
- **Dimensions**: Optionally specify the dimensions for the embeddings.
  - **Purpose**: Adjusts the complexity of the embedding output.
  - **Example**: 256 dimensions for detailed analysis.