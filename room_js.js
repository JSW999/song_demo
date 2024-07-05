document.addEventListener('DOMContentLoaded', () => {
    const socket = io('http://localhost:3000', {
        transports: ['websocket'],
        upgrade: false
    });
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    const userId = localStorage.getItem('userID');
    let joinRequestInProgress = false;
    let roomDeletedHandled = false;
    let userList = [];

    const userIdDisplay = document.getElementById('user-id-display');
    userIdDisplay.textContent = userId ? userId : 'User ID not found';

    socket.emit('registerUser', userId);

    socket.emit('getUserInfo', userId); 

    socket.on('userInfo', (data) => {
        const userImageBox = document.getElementById('user-image-box');
        const userNameDiv = document.getElementById('user-name');

        userImageBox.querySelector('img').src = data.userImage;
        userNameDiv.textContent = data.userName;
    });

    socket.on('joinRoomSuccess', (data) => {
        joinRequestInProgress = false;

        if (data.creator === userId) {
            const startButton = document.getElementById('start-room-btn');
            startButton.style.display = 'block';
            const deleteButton = document.getElementById('delete-room-btn');
            deleteButton.style.display = 'block';
            
            deleteButton.onclick = () => {
                if (!deleteButton.disabled) {
                    deleteButton.disabled = true;
                    socket.emit('deleteRoom', { roomId, userId });
                }
            };

            startButton.onclick = () => {
                socket.emit('moveGame', { roomId });
            };
        }
    });

    socket.on('roomFull', (data) => {
        alert(`Room ${data.roomId} is full.`);
        joinRequestInProgress = false;
    });

    socket.on('roomDeleted', (data) => {
        if (data.roomId === roomId && !roomDeletedHandled) {
            roomDeletedHandled = true;
            alert('방이 삭제되었습니다.');
            setTimeout(() => {
                window.location.href = 'http://localhost:8080/test/NewFile.html';
            }, 500);
        }
    });

    // 게임이 이미 시작된 방에 들어가려는 경우 처리
    socket.on('gameAlreadyStarted', (data) => {
        alert('게임이 이미 시작되었습니다!');
        setTimeout(() => {
            window.location.href = 'http://localhost:8080/test/NewFile.html';
        }, 500);
    });

    function joinRoom() {
        if (roomId && userId && !joinRequestInProgress) {
            joinRequestInProgress = true;
            setTimeout(() => {
                socket.emit('joinRoom', { roomId, userId });
            }, 1000);
        }
    }

    joinRoom();

    setupMessageHandling(socket, roomId, userId);
    setupRoomLeaving(socket, roomId, userId);
    setupUserList(socket);

    socket.on('connect', () => {
        joinRoom(); 
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    socket.on('moveGame', (data) => {
        const userList = data.userList;
        localStorage.setItem('userList', JSON.stringify(userList));  // Store userList in localStorage
        setTimeout(() => {
            window.location.href = `game.html?roomId=${roomId}`;
        }, 1000);
    });

    function setupMessageHandling(socket, roomId, userId) {
        const sendButton = document.getElementById('send-btn');
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');

        sendButton.onclick = () => {
            const message = chatInput.value;
            socket.emit('message', { roomId, message, userId });
            chatInput.value = '';
        };

        socket.on('message', (data) => {
            const messageElement = document.createElement('div');
            messageElement.textContent = data.message;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    function setupRoomLeaving(socket, roomId, userId) {
        const leaveButton = document.getElementById('leave-room-btn');
        let isLeaving = false;

        leaveButton.onclick = () => {
            if (!isLeaving) {
                isLeaving = true;
                leaveRoom(socket, roomId, userId);
            }
        };

        window.onbeforeunload = () => {
            if (!isLeaving) {
                isLeaving = true;
                leaveRoom(socket, roomId, userId);
            }
        };
    }

    function leaveRoom(socket, roomId, userId) {
        socket.emit('leaveRoom', { roomId, userId });
        setTimeout(() => {
            window.location.href = 'http://localhost:8080/test/NewFile.html';
        }, 500);
    }

    function setupUserList(socket) {
        socket.off('roomUsers');
        socket.on('roomUsers', (users) => {
            userList = users; // 사용자 목록 저장
            const userSlots = document.querySelectorAll('.user-slot');
            userSlots.forEach(slot => slot.innerHTML = '');

            users.forEach((user, index) => {
                if (userSlots[index]) {
                    userSlots[index].innerHTML = `
                        <div class="user-image-box">
                            <img src="${user.userImage}" alt="User Image">
                        </div>
                        <div class="user-name">${user.userId}</div>
                    `;
                    userSlots[index].style.backgroundColor = user.color;
                }
            });
        });
    }
});
