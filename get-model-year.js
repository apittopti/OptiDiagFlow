async function getModelYear() {
  try {
    const response = await fetch('http://localhost:6001/api/model-years');
    const data = await response.json();
    console.log('Available model years:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

getModelYear();