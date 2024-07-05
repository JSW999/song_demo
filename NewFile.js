document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:3000');
    const userID = localStorage.getItem('userID');

    if (userID) {
        document.getElementById('user-id-display').textContent = `${userID}`;
        document.getElementById('user-id').textContent = userID;
        socket.emit('registerUser', userID);
    } else {
        document.getElementById('user-id-display').textContent = 'User ID not found';
    }

    document.getElementById('create-room-btn').addEventListener('click', function() {
        document.getElementById('createRoomModal').style.display = 'block';
    });

    document.getElementById('closeModal').addEventListener('click', function() {
        document.getElementById('createRoomModal').style.display = 'none';
    });

    window.addEventListener('click', function(event) {
        if (event.target == document.getElementById('createRoomModal')) {
            document.getElementById('createRoomModal').style.display = 'none';
        }
    });

    document.getElementById('createRoomForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const roomName = document.getElementById('roomName').value;
        const password = document.getElementById('password').value;
        const playerCount = document.getElementById('playerCount').value;

        fetch('http://localhost:3000/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomName, password, playerCount, creator: userID })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('방 생성 실패: ' + data.error);
            } else {
                alert('방 생성 성공! 방 이름: ' + data.roomName);
                document.getElementById('createRoomModal').style.display = 'none';
                socket.emit('getRooms'); // 방 목록 갱신 요청
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('방 생성 실패');
        });
    });

    document.getElementById('room-list').addEventListener('click', (event) => {
        if (event.target.classList.contains('join-room-btn')) {
            const roomId = event.target.dataset.roomId;
            window.location.href = `http://localhost:8080/test/room.html?roomId=${roomId}`;
        }
    });

    socket.on('roomList', (rooms) => {
        updateRoomList(rooms);
    });

    socket.on('newRoom', (room) => {
        socket.emit('getRooms'); // 새로운 방이 생성되었을 때 방 목록 갱신 요청
    });

    socket.on('roomDeleted', (data) => {
        socket.emit('getRooms'); // 방이 삭제되었을 때 방 목록 갱신 요청
    });

    socket.on('updateRoom', (room) => {
        const roomItems = document.querySelectorAll('.room-item');
        roomItems.forEach(item => {
            const roomId = item.querySelector('.room-number').textContent;
            if (roomId === room.roomId) {
                const roomPlayers = item.querySelector('.room-players');
                roomPlayers.textContent = `${room.currentCount}/${room.playerCount}`;
            }
        });
    });

    socket.on('userList', (users) => {
        const userList = document.getElementById('user-info');
        if (userList) {
            userList.innerHTML = '';
            users.forEach(user => {
                const userItem = document.createElement('li');
                userItem.textContent = user;
                userList.appendChild(userItem);
            });
        } else {
            console.error('user-info 요소를 찾을 수 없습니다.');
        }
    });

    document.getElementById('user-image-box').addEventListener('click', () => {
        document.getElementById('imageModal').style.display = 'block';
    });

    document.getElementById('closeImageModal').addEventListener('click', () => {
        document.getElementById('imageModal').style.display = 'none';
    });

    document.getElementById('image-selection').addEventListener('click', (event) => {
        if (event.target.tagName === 'IMG') {
            const selectedImage = event.target.src;
            document.getElementById('user-image').src = selectedImage;
            document.getElementById('imageModal').style.display = 'none';
            socket.emit('updateUserImage', { userId: userID, imageUrl: selectedImage });
        }
    });

    socket.emit('getRooms'); // 초기 방 목록 요청

    socket.on('userImage', (imageUrl) => {
        document.getElementById('user-image').src = imageUrl;
    });

    fetch('http://localhost:3000/images')
        .then(response => response.json())
        .then(images => {
            const imageSelection = document.getElementById('image-selection');
            if (Array.isArray(images)) {
                images.forEach(image => {
                    const imgElement = document.createElement('img');
                    imgElement.src = `http://localhost:3000/images/${image}`;
                    imageSelection.appendChild(imgElement);
                });
            } else {
                console.error('이미지 파일 목록이 배열이 아닙니다.');
            }
        })
        .catch(error => {
            console.error('이미지 파일 목록을 불러오는 중 오류 발생:', error);
        });

    setupChatHandling(socket, userID); // 채팅 설정 함수 호출
});

function setupChatHandling(socket, userId) {
    const sendButton = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    sendButton.onclick = () => {
        const message = chatInput.value;
        socket.emit('mainMessage', { message, userId });
        chatInput.value = '';
    };

    socket.on('mainMessage', (data) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = data.message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // 새 메시지 추가 시 스크롤을 가장 아래로 이동
    });
}

function updateRoomList(rooms) {
    const roomList = document.getElementById('room-list');
    if (roomList) {
        roomList.innerHTML = '';
        if (rooms.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = '생성된 방이 없습니다.';
            roomList.appendChild(emptyMessage);
        } else {
            rooms.forEach(room => {
                if (room.started) return; // 이미 시작된 방은 목록에 표시하지 않음
                const roomItem = document.createElement('div');
                roomItem.className = 'room-item';
                roomItem.innerHTML = `
                    <span class="room-number">${room.roomId}</span>
                    <div class="room-details">
                        <span class="room-title">${room.roomName}</span>
                    </div>
                    <span class="room-players">${room.currentCount}/${room.playerCount}</span>
                    <button class="join-room-btn" data-room-id="${room.roomId}">참여</button>
                `;
                roomList.appendChild(roomItem);
            });
        }
    } else {
        console.error('room-list 요소를 찾을 수 없습니다.');
    }
}
