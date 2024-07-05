document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const userID = document.getElementById('userID').value;

    fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userID })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Registration failed: ' + data.error);
        } else {
            alert('Registration successful! Your token: ' + data.userToken);
            // userID 값을 로컬 스토리지에 저장
            localStorage.setItem('userID', userID);
            // NewFile.html로 리디렉션
            window.location.href = data.redirectUrl;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Registration failed');
    });
});
