document.addEventListener('DOMContentLoaded', () => {
	 // 소켓 초기화
    const socket = io('http://localhost:3000', {
        transports: ['websocket'],
        upgrade: false
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    const userList = JSON.parse(localStorage.getItem('userList'));
    const userId = localStorage.getItem('userID');
    const colors = ['red', '#ff7f00', 'yellow', 'green', 'blue', '#000080', 'purple', 'white'];
    
    let gameStarted = false; // 게임 시작 상태를 저장하는 전역 변수
    let currentAudio = null;
    let introAudio = null; // Intro audio
    let correctAnswered = false; // 정답이 맞춰졌는지 여부를 저장하는 변수
    let questionStarted = false; // 질문이 시작되었는지 여부를 저장하는 변수
    
    let skipCount = 0; // 스킵 요청 수
    let totalUsers = userList.length; // 전체 사용자 수
    let hasSkipped = false; // 사용자가 스킵을 요청했는지 여부
    let isHost = false; // 현재 유저가 방장인지 여부
    
    const playerListContainer = document.getElementById('player-list');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
	const questionArea = document.querySelector('.question-area');
	const answerArea = document.querySelector('.answer-area');
    const notificationSound = document.getElementById('notification-sound');
    
    const gameOverModal = document.getElementById('gameOverModal');
    const playerStats = document.getElementById('playerStats');
    const confirmBtn = document.getElementById('confirmBtn');
    
   // 방의 상태를 확인하여 게임이 이미 시작되었는지 확인
    socket.emit('checkRoomStatus', { roomId });

    socket.on('roomStatus', (data) => {
        if (data.started) {
            alert('이미 시작된 게임입니다!');
            window.location.href = 'http://localhost:8080/test/NewFile.html';
        } else {
            // 플레이어 목록 표시
            userList.forEach((user, index) => {
                const playerDiv = document.createElement('div');
                playerDiv.classList.add('player');
                playerDiv.innerHTML = `
                    <div class="player-color" style="background-color: ${colors[index % colors.length]};"></div>
                    <span id="player-${user.userId}">${user.userId}, ${user.correctCount}</span>
                `;
                playerListContainer.appendChild(playerDiv);
            });
			console.log('Game room joined successfully'); // 디버깅 로그 추가
            // 나머지 초기화 코드...
        }
    });
	
	socket.on('connect', () => {
		console.log('Connected to server');
		socket.emit('joinGameRoom', { roomId, userId });
		
		
		// Intro audio 재생
        introAudio = new Audio('http://localhost:3000/audio/introSound.mp3');
        introAudio.loop = true;
        introAudio.play();
	});

	socket.on('disconnect', () => {
		const gameRoomId = `${roomId}G`;
		socket.emit('leaveGameRoom', { gameRoomId, userId });
		console.log('Disconnected from server');
	});
	
    // 방 나가기 처리 함수
	const handleLeaveRoom = (redirectUrl = 'http://localhost:8080/test/NewFile.html', removeBeforeUnload = false) => {
		console.log(`handleLeaveRoom called with redirectUrl: ${redirectUrl}`); // 디버깅 로그 추가
		socket.emit('leaveGameRoom', { roomId: roomId, userId });
		if (removeBeforeUnload) {
			window.removeEventListener('beforeunload', handleBeforeUnload); // beforeunload 리스너 제거
		}
		setTimeout(() => {
			window.location.href = redirectUrl;
		}, 500);
	};

	// beforeunload 이벤트 핸들러 함수 정의
	const handleBeforeUnload = (event) => {
		event.preventDefault();
		event.returnValue = '';
		handleLeaveRoom();
	};
    // 페이지 언로드 시 방 나가기
    window.addEventListener('beforeunload', handleBeforeUnload);
      

    // 새로운 채팅 메시지를 표시하는 함수
    const displayMessage = (message) => {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        chatMessagesContainer.appendChild(messageDiv);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    };

    // 전송 버튼 클릭 핸들러
    sendButton.addEventListener('click', () => {
		const gameRoomId = `${roomId}G`;
        const message = chatInput.value.trim();
        if (message) {
            socket.emit('gameMessage', { roomId: gameRoomId, message, userId });
            
            if (message.startsWith('/')) {
                handleCommand(message);
            }
            
            // 정답이 맞춰지지 않은 경우에만 정답 메시지를 보냄
            if (!correctAnswered) {
                socket.emit('checkAnswer', { roomId: gameRoomId, message, userId });
            }
            
            chatInput.value = '';
        }
    });

    // Enter 키로 메시지 전송 핸들러
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendButton.click();
        }
    });

    // 서버로부터의 메시지 수신 핸들러
    socket.on('gameMessage', (data) => {
        displayMessage(data.message);
    });
	
	const handleCommand = (message) => {
        if (message === '/시작' && !gameStarted) {  // 게임이 이미 시작되지 않은 경우에만 실행
        	console.log('Starting game'); // 디버깅 로그 추가	
            socket.emit('startGame', { roomId, userId });
        } else if (message === '/스킵' && questionStarted && !hasSkipped) {  // 질문이 시작된 경우에만 실행
            socket.emit('skipRequest', { roomId, userId });
            hasSkipped = true;
            console.log("skip요청");
        }
    };
    
    // 게임 시작 이벤트 핸들러
	socket.on('gameStarted', (data) => {
		gameStarted = true;  // 게임이 시작된 것으로 설정
		
		  if (userId === data.creator) {
            isHost = true;
            console.log(data.creator + '방의 호스트 true');
        }
        
		const introMessages = [
            '즛토마요 노래 맞추기에 어서오세요',
            '게임 방식',
            '노래가 들린다 -> 제목을 쓴다 정답!',
            '문제는 즛토마요 노래 전곡입니다',
            '문제는 하이라이트 구간부터 시작합니다',
            '문제를 맞추고 난 뒤 노래 1절을 듣고 다음 문제에 넘어갑니다',
            '스킵을 원할 시 채팅으로 /스킵!을 써주세요 (절반 이상이 찬성해야 스킵됩니다)',
            '5초 뒤에 게임이 시작됩니다!'
        ];

        const countdownMessages = ['5', '4', '3', '2', '1'];
        
        questionArea.textContent = '';  // 기존 내용을 지우고 새로 시작
        let index = 0;

        const displayIntroMessages = () => {
            if (index < introMessages.length) {
                notificationSound.play();  // 소리 재생
                setTimeout(() => {
                    questionArea.textContent = introMessages[index];
                    index++;
                    setTimeout(displayIntroMessages, 3000);  // 3초 간격으로 메시지 출력
                }, 0);  // 소리가 먼저 재생되고, 텍스트가 나옴
            } else {
                index = 0;
                displayCountdownMessages();
            }
        };

        const displayCountdownMessages = () => {
            if (index < countdownMessages.length) {
                questionArea.textContent = countdownMessages[index];
                index++;
                setTimeout(displayCountdownMessages, 1000);  // 1초 간격으로 메시지 출력
            } else {
                questionArea.textContent = '게임 시작!';
                questionStarted = true;  // 질문 시작으로 설정
                if (isHost) {
                    // 방장인 경우에만 nextQuestion 요청을 보냅니다.
                    setTimeout(() => {
                        socket.emit('nextQuestion', { roomId });  // 첫 번째 문제 시작 요청
                    }, 1000); // 약간의 지연을 추가하여 시작 메시지가 보이는 시간을 줍니다.
                }
            }
        };

        displayIntroMessages();
    });
    
	// 모든 사용자에게 intro audio 정지를 요청
	socket.on('stopIntroAudio', () => {
		if (introAudio) {
			introAudio.pause();
			introAudio.currentTime = 0;
		}
	});
	socket.on('newQuestion', (data) => {
		const { songUrl, questionNumber } = data;
		questionArea.textContent = `문제 ${questionNumber}`;
		correctAnswered = false;  // 새로운 문제로 초기화
		skipCount = 0; // 스킵 카운트 초기화
        hasSkipped = false; // 스킵 요청 초기화
        
        clearSkipStatus(); // 스킵 상태 제거
        
        // 새로운 문제 시작 시 정답 표시 영역을 초기화
        answerArea.innerHTML = '';
        
		if (currentAudio) {
			currentAudio.pause();
			currentAudio.currentTime = 0;
		}

		console.log(`Playing song: ${songUrl}`); // 디버깅 로그 추가

		currentAudio = new Audio(`http://localhost:3000${songUrl}`);
		console.log(currentAudio); // 디버깅 로그 추가
		currentAudio.play();

		currentAudio.onended = () => {
			// 현재 문제의 노래가 끝나면 아무 처리도 하지 않음
		};
	});

    socket.on('correctAnswer', (data) => {
        const { userId, songTitle, correctCount } = data;
        answerArea.innerHTML = `<div><span class="highlight">${userId}</span> 정답!</div><div>${songTitle}</div>`;
        correctAnswered = true;  // 정답이 맞춰졌음을 표시
        
        let userElement = document.getElementById(`player-${userId}`);
        if (userElement) {
            userElement.textContent = `${userId}, ${correctCount}`;
        }
        
        if (currentAudio) {
            currentAudio.currentTime = 0; // 오디오를 처음으로 되돌림
            currentAudio.play();
            currentAudio.onended = () => {
				setTimeout(() => {
					if (isHost) {
						socket.emit('nextQuestion', { roomId });  // 오디오가 끝난 후 다음 문제 요청
					}
				}, 2000);
			};
        } else {
            setTimeout(() => {
                if (isHost) {
                    socket.emit('nextQuestion', { roomId });
                }
            }, 5000);  // 만약 오디오가 없다면 5초 후 다음 문제 요청
        }
    });
    
    
    socket.on('gameOver', (data) => {
        questionArea.textContent = '게임 종료!';
        
        const finishSong = new Audio('http://localhost:3000/audio/finishSong.mp3');
        finishSong.play();

        gameOverModal.style.display = 'block';

        playerStats.innerHTML = '';
        data.players.forEach((user, index) => {
            const playerStatDiv = document.createElement('div');
            playerStatDiv.style.color = colors[index % colors.length];
            playerStatDiv.textContent = `${user.userId}: ${user.correctCount}점`;
            playerStats.appendChild(playerStatDiv);
        });

        confirmBtn.onclick = () => {
            gameOverModal.style.display = 'none';
            console.log('종료 모달창 - 확인버튼 클릭 -' + roomId + '방 이동');
            handleLeaveRoom(`http://localhost:8080/test/room.html?roomId=${roomId}`, true);
        };
        
		userList.forEach(user => {
			user.correctCount = 0;
		});
    });
    
    // 추가적인 소켓 이벤트 핸들러...
    // 서버로부터 스킵 상태를 수신
    socket.on('skipStatus', (data) => {
        skipCount = data.skipCount;
        totalUsers = data.totalUsers;
        updateSkipStatus();
    });
    
    // 스킵 상태 업데이트
    const updateSkipStatus = () => {
        let skipStatusElement = document.querySelector('.skip-status');
        if (!skipStatusElement) {
            skipStatusElement = document.createElement('div');
            skipStatusElement.classList.add('skip-status');
            answerArea.appendChild(skipStatusElement); // answerArea 아래에 추가
        }
        skipStatusElement.textContent = `스킵(${skipCount}/${totalUsers})`;
    };

    // 새로운 문제로 넘어갈 때 스킵 상태 제거
    const clearSkipStatus = () => {
        const skipStatusElement = document.querySelector('.skip-status');
        if (skipStatusElement) {
            skipStatusElement.remove();
        }
    };
});
