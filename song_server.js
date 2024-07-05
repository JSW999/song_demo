const express = require('express');
const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: "http://localhost:8080",
		methods: ["GET", "POST"],
		allowedHeaders: ["Content-Type"],
		credentials: true
	}
});

const port = 3000;
const users = new Map();
const rooms = {};
const skipVotes = new Map(); // 방 별로 스킵 요청을 관리하는 변수

// MySQL 연결 설정
const db = mysql.createPool({
	host: 'localhost',
	user: 'root',
	password: '1234',
	database: 'song_db',
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0
});

// CORS 설정 추가
app.use(cors({
	origin: 'http://localhost:8080',
	methods: ['GET', 'POST'],
	allowedHeaders: ['Content-Type'],
	credentials: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../test/public')));
app.use('/song', express.static(path.join(__dirname, '../test/public/song'))); // 정적 파일 경로 설정

// 유저 등록 엔드포인트
app.post('/register', (req, res) => {
	const userID = req.body.userID;
	const userToken = uuidv4();
	const selectQuery = 'SELECT * FROM users WHERE userID = ?';
	const insertQuery = 'INSERT INTO users (userID, userToken) VALUES (?, ?)';

	db.query(selectQuery, [userID], (err, results) => {
		if (err) {
			console.error('Database error:', err);
			res.status(500).json({ error: 'Internal server error', details: err.message });
			return;
		}

		if (results.length > 0) {
			res.status(400).json({ error: 'User ID already exists' });
			return;
		}

		db.query(insertQuery, [userID, userToken], (err, result) => {
			if (err) {
				console.error('Database error:', err);
				res.status(500).json({ error: 'Internal server error', details: err.message });
				return;
			}
			res.status(200).json({ message: 'User registered successfully', userToken, redirectUrl: 'NewFile.html' });
		});
	});
});

// 방 생성 엔드포인트
app.post('/create-room', (req, res) => {
	const { roomName, password, playerCount, creator } = req.body;

	db.query('SELECT MAX(roomId) AS maxRoomId FROM rooms WHERE roomId < 1000', (err, result) => {
		if (err) {
			console.error('Database error:', err);
			res.status(500).json({ error: 'Internal server error', details: err.message });
			return;
		}

		let nextRoomId = 1;
		if (result.length > 0 && result[0].maxRoomId != null) {
			nextRoomId = (result[0].maxRoomId % 1000) + 1;
		}

		const insertQuery = 'INSERT INTO rooms (roomId, roomName, password, playerCount, creator) VALUES (?, ?, ?, ?, ?)';
		db.query(insertQuery, [nextRoomId, roomName, password, playerCount, creator], (err, result) => {
			if (err) {
				console.error('Database error:', err);
				res.status(500).json({ error: 'Internal server error', details: err.message });
				return;
			}
			rooms[nextRoomId] = { roomName, players: [], playerCount: parseInt(playerCount), creator };
			io.emit('newRoom', { roomId: nextRoomId, roomName, playerCount, currentCount: 0 });
			res.status(200).json({ message: 'Room created successfully', roomId: nextRoomId, roomName, creator });
		});
	});
});

// 이미지 파일 목록 제공
app.get('/images', (req, res) => {
	const imagesDir = 'C:/eclipse-workspace/test/public/images';
	console.log("Serving images from:", imagesDir); // 경로 로깅
	fs.readdir(imagesDir, (err, files) => {
		if (err) {
			console.error('Error reading directory:', imagesDir);  // 오류 로깅
			return res.status(500).json({ error: 'Failed to load images' });
		}
		res.json(files);
	});
});

// 이미지 파일 제공
app.get('/images/:filename', (req, res) => {
	const filename = req.params.filename;
	const imagesDir = 'C:/eclipse-workspace/test/public/images';
	const filePath = path.join(imagesDir, filename);

	console.log("Attempting to send:", filePath); // 경로 로깅
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			console.error('File not found:', filePath);  // 오류 로깅
			return res.status(404).send('File not found');
		}
		res.sendFile(filePath);
	});
});

app.get('/audio', (req, res) => {
	const audioDir = 'C:/eclipse-workspace/test/public/audio';
	console.log("Serving audio from:", audioDir); // 경로 로깅
	fs.readdir(audioDir, (err, files) => {
		if (err) {
			console.error('Error reading directory:', audioDir);  // 오류 로깅
			return res.status(500).json({ error: 'Failed to load audio' });
		}
		res.json(files);
	});
});

// 오디오 파일 제공
app.get('/audio/:filename', (req, res) => {
	const filename = req.params.filename;
	const audioDir = 'C:/eclipse-workspace/test/public/audio';
	const filePath = path.join(audioDir, filename);

	console.log("Attempting to send:", filePath); // 경로 로깅
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			console.error('File not found:', filePath);  // 오류 로깅
			return res.status(404).send('File not found');
		}
		res.sendFile(filePath);
	});
});

// 노래 파일 목록 제공
app.get('/song', (req, res) => {
	const songDir = 'C:/eclipse-workspace/test/public/song';
	console.log("Serving songs from:", songDir); // 경로 로깅
	fs.readdir(songDir, (err, files) => {
		if (err) {
			console.error('Error reading directory:', songDir);  // 오류 로깅
			return res.status(500).json({ error: 'Failed to load songs' });
		}
		res.json(files);
	});
});

// 노래 파일 제공
app.get('/song/:filename', (req, res) => {
	const filename = req.params.filename;
	const songDir = 'C:/eclipse-workspace/test/public/song';
	const filePath = path.join(songDir, filename);

	console.log("Attempting to send:", filePath); // 경로 로깅
	fs.access(filePath, fs.constants.F_OK, (err) => {
		if (err) {
			console.error('File not found:', filePath);  // 오류 로깅
			return res.status(404).send('File not found');
		}
		res.sendFile(filePath);
	});
});


// 소켓 연결 및 이벤트 처리
io.on('connection', socket => {
	console.log('New client connected');

	socket.on('registerUser', userId => {
		console.log(`Registering user: ${userId}`);
		registerUser(socket, userId);
	});

	socket.on('getUserInfo', userId => {
		db.query('SELECT imageUrl, userID FROM users WHERE userID = ?', [userId], (err, result) => {
			if (err) {
				console.error('Database error:', err);
				return;
			}
			if (result.length > 0) {
				const userInfo = {
					userId: userId,
					userImage: result[0].imageUrl,
					userName: result[0].userID // userName 대신 userID를 사용
				};
				socket.emit('userInfo', userInfo); // 클라이언트로 사용자 정보 전송
			}
		});
	});

	socket.on('getRooms', () => {
		getRooms(socket);
	});

	socket.on('joinRoom', data => {
		const user = users.get(socket.id);
		if (!user) {
			console.log(`User not found for socket id: ${socket.id}`);
			return;
		}
		joinRoom(socket, data);

	});

	socket.on('leaveRoom', data => {
		const user = users.get(socket.id);
		if (!user) {
			console.log(`User not found for socket id: ${socket.id}`);
			return;
		}
		leaveRoom(socket, data);
	});

	socket.on('message', data => {
		const { roomId, message, userId } = data;
		const formattedMessage = `${userId}: ${message}`;
		io.to(roomId).emit('message', { message: formattedMessage });
		console.log(data);
	});

	// 메인 페이지 채팅 메시지 수신 및 전송
	socket.on('mainMessage', ({ message, userId }) => {
		const formattedMessage = `${userId}: ${message}`;
		io.emit('mainMessage', { message: formattedMessage });
	});

	socket.on('gameMessage', (data) => {
		const { roomId, message, userId } = data;
		const formattedMessage = `${userId}: ${message}`;
		io.to(roomId).emit('gameMessage', { message: formattedMessage });
		console.log(data);

	});

	// 정답 확인 로직 추가
	socket.on('checkAnswer', (data) => {
		const { roomId, message, userId } = data;
		const room = rooms[roomId];

		if (room && room.currentSong) {
			const normalizedMessage = normalizeString(message);
			const isCorrect = room.currentSong.answers.some(answer => answer === normalizedMessage);

			if (isCorrect) {
				const user = room.players.find(player => player.userId === userId);

				if (user) {
					user.correctCount = (user.correctCount || 0) + 1;
					io.to(roomId).emit('correctAnswer', { userId, songTitle: room.currentSong.title, correctCount: user.correctCount });
					console.log(`${userId} has answered correctly. Correct count: ${user.correctCount}`);
				}
			}
		}
	});

	socket.on('updateUserImage', data => {
		updateUserImage(data);
	});

	socket.on('deleteRoom', data => {
		const { roomId, userId } = data;
		if (rooms[roomId] && rooms[roomId].creator === userId) {
			const roomClients = io.sockets.adapter.rooms.get(roomId.toString());
			if (roomClients) {
				for (let clientId of roomClients) {
					const clientSocket = io.sockets.sockets.get(clientId);
					clientSocket.leave(roomId);
					clientSocket.emit('roomDeleted', { roomId });
				}
			}
			delete rooms[roomId];
			db.query('DELETE FROM rooms WHERE roomId = ?', [roomId], (err, result) => {
				if (err) {
					console.error('Database error:', err);
					return;
				}
				io.emit('roomDeleted', { roomId }); // 모든 클라이언트에게 방 삭제 이벤트 전송
			});
		} else {
			console.log(`User ${userId} is not authorized to delete room ${roomId}`);
		}
	});

	socket.on('moveGame', (data) => {
		const { roomId } = data;
		moveGame(roomId);
	});

	socket.on('joinGameRoom', data => {
		const { roomId, userId } = data;
		const gameRoomId = `${roomId}G`;
		socket.join(gameRoomId);
		console.log(`게임 시작 - ${userId}가 ${gameRoomId}방에 참가하였습니다`);
	});


	socket.on('leaveGameRoom', data => {
		const { roomId, userId } = data;
		const gameRoomId = `${roomId}G`;
		socket.leave(gameRoomId);
		console.log(`게임 종료 - ${userId}가 ${gameRoomId}방에 나갔습니다`);
		
	});


	socket.on('checkRoomStatus', data => {
		const { roomId } = data;
		const gameRoomId = `${roomId}G`;
		if (rooms[gameRoomId]) {
			socket.emit('roomStatus', { started: rooms[gameRoomId].started });
			console.log('gameRoomId started 생성');
		} else {
			socket.emit('roomStatus', { started: false });
			console.log('gameRoomId started false');
		}
	});

	socket.on('startGame', data => {
		const { roomId, userId } = data;
		const gameRoomId = `${roomId}G`;
		if (rooms[roomId] && rooms[roomId].creator === userId) {
			if (rooms[gameRoomId]) {
				rooms[gameRoomId].started = true;
				io.to(gameRoomId).emit('gameStarted', { roomId: gameRoomId, creator: rooms[roomId].creator });
				io.to(gameRoomId).emit('stopIntroAudio'); // 모든 사용자에게 intro audio 정지를 요청
				console.log(`Game started in room ${gameRoomId} by ${userId}`);
			} else {
				console.error(`Game room not found: ${gameRoomId}`);
			}
		} else {
			console.log(`User ${userId} is not authorized to start game in room ${roomId}`);
		}
	});

	socket.on('nextQuestion', data => {
		const { roomId } = data;
		const gameRoomId = `${roomId}G`;
		console.log(`Next question for room ${roomId}`); // 디버깅 로그 추가
		startNextQuestion(gameRoomId);
	});

	// 스킵 요청 처리 로직 추가
	socket.on('skipRequest', (data) => {
		const { roomId, userId } = data;
		const gameRoomId = `${roomId}G`;
		if (!skipVotes.has(gameRoomId)) {
			skipVotes.set(gameRoomId, new Set());
		}
		const skipSet = skipVotes.get(gameRoomId);

		// 이미 스킵 요청을 한 유저는 다시 요청할 수 없도록 처리
		if (skipSet.has(userId)) {
			return;
		}

		skipSet.add(userId);

		const totalUsers = rooms[gameRoomId]?.players?.length || 0;
		console.log(totalUsers + '토탈유저 수 - 스킵');
		const skipCount = skipSet.size;
		console.log(skipCount + '스킵 카운트 - 스킵');

		io.to(gameRoomId).emit('skipStatus', { skipCount, totalUsers });

		if (skipCount > totalUsers / 2) {
			console.log('스킵요청 발동 if');
			startNextQuestion(gameRoomId); // 직접 호출
			skipVotes.delete(gameRoomId); // 스킵 요청 초기화
		}
	});

	socket.on('disconnect', () => {
		disconnectUser(socket);
	});
});

server.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

function normalizeString(str) {
	return str.replace(/\s+/g, '').toLowerCase();
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

function getAnswersForSong(songFile) {
	const songTitle = path.basename(songFile, path.extname(songFile)).toLowerCase();
	const answersMap = {
		'초침을 깨물다': ['byoushinwo kamu', '초침을 깨물다', '초침을 씹다', '뵤우신오 카무', '뵤오신오 카무', '뵤오신오 깨물다', '초침을 카무', '뵤신오 카무'],

		'뇌리 위의 크래커': ['nouriueno cracker', '脳裏上のクラッカー', '뇌리 위의 크래커', '노우리우에노 쿠락카', '노오리우에노 크락카', '노오리우에노 쿠락카', '노오리우에노 크라카',
			'노오리우에노 크랔카', '노우리우에노 크랔카'],

		'휴머노이드': ['humanoid', 'ヒューマノイド', '휴머노이드', '휴마노이드'],

		'눈부신 dna뿐': ['mabushii dna dake', '眩しいDNAだけ', '눈부신 DNA뿐', '마부시이 디엔에이 다케', '마부시이 dna 다케', '눈부신 dna 다케'],

		'정의': ['seigi', '正義', '정의', '세이기'],

		'걷어차버린 담요': ['kettobashita moufu', '蹴っ飛ばした毛布', '걷어차버린 담요', '켙토바시타 모우후', '켙토바시타 모오후', '켓토바시타 모우후', '켓토바시타 모오후', '켓토바시타 모후',
			'켙토바시타 모후', '케토바시타 모오후', '케토바시타 모후', '켙토바시타 모포', '켓토바시타 모포', '케토바시타 모포', '걷어차버린 모포', '케토바시타 모우후'],

		'이런 일 소동': ['konnakoto soudou', 'こんなこと騒動', '이런 일 소동', '콘나코토 소우도우', '콘나코토 소오도오', '콘나코토 소도', '콘나코토 소오도우'],

		'망둥이 달린다 끝까지': ['haze haseru haterumade', 'ハゼ馳せる果てるまで', '망둥이 달린다 끝까지', '망둥어 달린다 끝까지', '하제 하세루 하테루마데'],

		'dear. mr f': ['Dear. Mr F', 'Dear Mr F', '디어 미스터 에프', '디아 미스터 에프', '디어 미스타 에프', '디아 미스타 에프', '친애하는 F씨', '친애하는 미스터 F'],

		'새턴': ['saturn', 'サターン', '새턴', '사턴', '사탄'],

		'공부해 둬': ['study me', 'お勉強しといてよ', '공부해 둬', '공부해 줘', '공부해 놔', '스터디미', '오벤쿄시토이테요', 'obenkyou shitoiteyo'],

		'milabo': ['milabo', '밀라보', '미라보'],

		'저혈 볼트': ['fastening', '低血ボルト', '저혈 볼트', 'teiketsu boruto', '테이케츠 보루토', '테에케츠 보루토'],

		'ham': ['ham', '햄', '함', '하무'],

		'감 그레이': ['hunch gray', '勘ぐれい', '감 그레이', 'kan gurei', '칸 구레이', '칸 그레이'],

		'올바르게 될 수 없어': ['cant be right', '正しくなれない', '올바르게 될 수 없어', '올바르게 될수 없어', 'tadashiku narenai', '타다시쿠 나레나이', '좌빨'],

		'어둡게 검게': ['darken', '暗く黒く', '어둡게 검게', '다큰', '달큰', 'kuraku kuroku', '쿠라쿠 쿠로쿠'],

		'마음의 연기': ['ones mind', '胸の煙', '마음의 연기', 'muneno kemuri', '무네노 케무리'],

		'감이 좋아서 분해': ['kan saete kuyashiiwa', '勘冴えて悔しいわ', '감이 좋아서 분해', '칸 사에테 쿠야시이와'],

		'저 녀석들 전원 동창회': ['inside joke', 'あいつら全員同窓会', '저 녀석들 전원 동창회', 'aitsura zenindousoukai', 'aitura zenindousoukai', '아이츠라 젠인도우소우카이',
			'아이츠라 젠인도오소오카이', '아이츠라 젠인도소카이'],

		'바보가 아닌데도': ['stay foolish', 'ばかじゃないのに', '바보가 아닌데도', '바보가 아닌데', 'bakajya nainoni', '바카쟈 나이노니'],

		'네코 리셋': ['neko reset', '猫リセット', '고양이 리셋', '네코 리셋', '네코 리셋토', '네코 리셑토'],

		'소매의 퀼트': ['quilt', '袖のキルト', '소매의 퀼트', '소매의 퀄트', 'sodeno kiruto', '소데노 키루토'],

		'미러 튠': ['mirror tune', 'ミラーチューン', '미러 튠', '미라 튠', '밀러 튠', '미러미러 튠', '미러미러 튠~', '미라미라 튠', '미라미라 튠~', '미라 츙', '미라아 츄웅', '미라 츄웅'],

		'사라져버릴 것 같아요': ['blush', '消えてしまいそうです', '사라져버릴 것 같아요', 'kiete shimai soudesu', 'kiete simai soudesu', '키에테 시마이 소우데스', '키에테 시마이 소오데스',
			'키에테 시마이 소데스'],

		'여름철': ['summer slack', '夏枯れ', '여름철', 'natsugare', 'natugare', '나츠가레'],

		'잔기': ['time left', '残機', '잔기', '남은 목숨', 'zanki', '잔키'],

		'키라 킬러': ['kira killer', '綺羅キラー', '키라 킬러', '키라 킬라', '키라킬라', 'kira kira-', 'kira kira', '키라 키라-', '키라 키라'],

		'불법침입': ['intrusion', '不法侵入', '불법침입', 'huhou sinnyuu', '후호우 신뉴우', '후호오 신뉴우'],

		'하나이치몬메': ['hanaichi monnme', '花一匁', '하나이치몬메', '꽃한돈'],

		'친숙한 서브': ['nareai serve', '馴れ合いサーブ', '나레아이 서브', '나레아이 사브', '친숙한 서브', '친숙한 사브', 'nareai sa-bu', 'nareai sabu'],

		'거짓이 아니야': ['truth in lies', '嘘じゃない', '거짓이 아니야', '우소쟈 나이', 'usojya nai'],
		// 추가적인 노래 파일과 정답 목록을 여기에 추가합니다.
		// 'song-title': ['정답1', '정답2', '정답3']
		// 7.1 노래 추가 목록
		'다른 노래로 하자': ['Flow Different', '다른 노래로 하자', '違う曲にしようよ', '치가우 쿄쿠니 시요우요', '치가우 쿄쿠니 시요오요', 'Chigau kyokuni shiyouyo',
			'chigau kyokuni siyouyo'],

		'한밤중의 키스미': ['Kisumi at Midnight', '한밤중의 키스미', '夜中のキスミ', '요나카노 키스미', 'Yonaka no Kisumi'],

		'상냥하게 last smile': ['Yasashiku Last Smile', '優しくLAST SMILE', '상냥하게 LAST SMILE', '상냥하게 라스트 스마일', 'yasashiku rasuto sumairu',
			'yasasiku rasuto sumairu', '야사시쿠 라스토 스마이루'],

		'과면': ['Hypersomnia', '過眠', '과면', 'kamin', '카민'],

		'또 만나 환상': ['Matane Maboroshi', 'またね幻', '또 만나 환상', '마타네 마보로시'],

		'반복되는 수확': ['Crop', '繰り返す収穫', '반복되는 수확', 'kurikaesu shuukaku', '쿠리카에스 슈우카쿠'],

		'글라스와 럼 레이즌': ['Glass To Rum Raisin', 'グラスとラムレーズン', '글라스와 럼 레이즌', 'gurasuto ramurezun', 'gurasuto ramure-zun', '구라스토 라무레-즌', '그라스토 라무레-즌',
			'구라스토 라무레즌', '그라스토 라무레즌', '그라스토 라무레에즌', '구라스토 라무레에즌'],

		'네가 있어서 물거품이 돼': ['Kimigaite Mizuninaru', '君がいて水になる', '네가 있어서 물거품이 돼', '키미가이테 미즈니나루'],

		'마린 블루의 정원': ['Marine Blue Garden', 'マリンブルーの庭園', '마린 블루의 정원', 'marinburu-no teien', 'marinburu no teien', '마린부루노 테이엔', '마린부루노 테에엔',
			'마린브루노 테이엔', '마린브루노 테에엔'],

		'방황하는 취한 온도': ['Samayoi Yoi Ondo', '彷徨い酔い温度', '방황하는 취한 온도', '사마요이 요이 온도'],

		'성게와 밤': ['Uni To Kuri', '雲丹と栗', '성게와 밤', '우니 토 구리'],

		'해브 어': ['Have A', 'はゔぁ', '해브 어', '해브 아', '하봐', '하봐아'],

		'론리네스': ['Loneliness', 'ろんりねす', '론리네스', 'ronrinesu'],

		'말뚝잠 원정대': ['Inemuri Enseitai', '居眠り遠征隊', '말뚝잠 원정대', '이네무리 엔세이타이', '이네무리 엔세에타이'],

		'기계유': ['Engine Oil', '機械油', '기계유', 'kikaiyu', '키카이유'],

		'jk bomber': ['JK BOMBER', '여고생 폭격기', '여고생 폭탄', '여고딩 폭격기', '여고딩 폭탄', '제이케이 봄바', '제이케이 봄버'],

		'깊은 곳에 잠든 뿌리': ['Inner Heart', '奥底に眠るルーツ', '깊은 곳에 잠든 뿌리', 'okusoko ni nemuru rutsu', 'okusoko ni nemuru ruutsu', '오쿠소코니 네무루 루츠'],

		'마이너리티 맥락': ['Minority Myakuraku', 'マイノリティ脈絡', '마이너리티 맥락', '마이나리티 맥락', '마이노리티 맥락', '마이노리티 먀쿠라쿠'],

		'blues in the closet': ['Blues in the Closet', '블루스 인 더 클로셋', '브루스 인 더 클로셋']
	};

	const answers = answersMap[songTitle] || [songTitle];
	return answers.map(normalizeString);
}

function startNextQuestion(roomId) {
	console.log('startNextQuestion / ' + roomId);
	const room = rooms[roomId];
	const originalRoomId = roomId.replace(/G$/, '');
	if (!room || !room.songList || room.songList.length === 0) {
		console.log('No room found or song list is empty'); // 디버깅 로그 추가
		return;
	}

	const nextSongIndex = room.currentSongIndex !== undefined ? room.currentSongIndex + 1 : 0;
	if (nextSongIndex >= room.songList.length) {
		console.log(`Game over for room ${roomId}`); // 디버깅 로그 추가
		
		if (rooms[originalRoomId]) {
			rooms[originalRoomId].started = false;
			rooms[roomId].started = false;
			console.log('게임 종료- ' + originalRoomId + '방 started = false')
		}
		io.to(roomId).emit('gameOver', { players: room.players }); // 게임 종료 시 플레이어 데이터 전송
		
		// 정답 개수 초기화
        room.players.forEach(player => {
            player.correctCount = 0;
        });
		room.currentSongIndex = -1; // 초기화
		console.log(room.players);
		return;
	}

	room.currentSongIndex = nextSongIndex;
	const songFile = room.songList[nextSongIndex];
	const songUrl = `/song/${songFile}`;

	console.log(`Starting question ${nextSongIndex + 1} with song: ${songFile}`);  // 디버깅 로그 추가
	// 노래 파일과 함께 정답 목록을 저장합니다.
	const answers = getAnswersForSong(songFile);

	room.currentSong = { title: path.basename(songFile, path.extname(songFile)), url: songUrl, answers };

	io.to(roomId).emit('newQuestion', { songUrl, questionNumber: nextSongIndex + 1 });
	console.log(songUrl + '/ ' + songFile + '/ ' + 'startNextQuestion 실행');
}

function moveGame(roomId) {
	if (rooms[roomId]) {
		rooms[roomId].started = true;
		const gameRoomId = `${roomId}G`;
		if (!rooms[gameRoomId]) {
			rooms[gameRoomId] = { started: false, players: [...rooms[roomId].players], playerCount: 0, creator: rooms[roomId].creator, songList: [], currentSongIndex: -1 }; // 초기화
			console.log('gameRoomId 초기화 완료 - moveGame');
		}
		const userList = rooms[roomId].players;
		// correctCount 초기화
		userList.forEach(user => {
			user.correctCount = 0;
		});

		rooms[gameRoomId].playerCount = userList.length;
		io.to(roomId).emit('moveGame', { userList });
		io.emit('getRooms'); // 방 목록 갱신 요청

		// 노래 파일 로드
		const songsDir = 'C:/eclipse-workspace/test/public/song';
		fs.readdir(songsDir, (err, files) => {
			if (err) {
				console.error('Error reading directory:', songsDir);
				return;
			}
			rooms[gameRoomId].songList = shuffle(files); // 노래 목록을 랜덤으로 섞음
			console.log(`Loaded songs for gameRoomId ${gameRoomId}:`, rooms[gameRoomId].songList);  // 디버깅 로그 추가
		});
	}
}

// 소켓 이벤트 핸들링 함수 정의
function registerUser(socket, userId) {
	if (!userId) {
		console.error(`User ID is missing for socket id: ${socket.id}`);
		return;
	}
	users.set(socket.id, { userId, rooms: [] }); // rooms 배열 추가
	io.emit('userList', Array.from(users.values()).map(user => user.userId));

	const query = 'SELECT imageUrl FROM users WHERE userID = ?';
	db.query(query, [userId], (err, results) => {
		if (err) {
			console.error('Database error:', err);
			return;
		}
		const imageUrl = results.length > 0 ? results[0].imageUrl : 'default-image.png';
		socket.emit('userImage', imageUrl);
	});
}

// 방 목록 갱신 시 이미 시작된 방은 제외
function getRooms(socket) {
	const query = 'SELECT roomId, roomName, playerCount FROM rooms';
	db.query(query, (err, results) => {
		if (err) {
			console.error('Database error:', err);
			return;
		}

		const roomsWithCounts = results.map(room => {
			const clients = io.sockets.adapter.rooms.get(room.roomId.toString());
			const currentCount = clients ? clients.size : 0;
			return {
				roomId: room.roomId,
				roomName: room.roomName,
				playerCount: room.playerCount,
				currentCount,
				started: rooms[room.roomId] ? rooms[room.roomId].started : false // 추가
			};
		}).filter(room => !room.started); // 시작된 방은 목록에서 제외

		socket.emit('roomList', roomsWithCounts);
	});
}

function joinRoom(socket, data) {
	const { roomId, userId } = data;
	console.log(`방 참여 - ${userId}가 ${roomId}방에 참가하였습니다`);
	const user = users.get(socket.id);
	if (!user) {
		console.error(`User not found for socket id: ${socket.id}`);
		return;
	}

	if (user.rooms.includes(roomId)) {
		return;
	}

	db.query('SELECT playerCount, creator FROM rooms WHERE roomId = ?', [roomId], (err, result) => {
		if (err) {
			console.error('Database error:', err);
			return;
		}

		if (result.length > 0) {
			const maxPlayers = result[0].playerCount;
			const creator = result[0].creator;
			const clients = io.sockets.adapter.rooms.get(roomId.toString());
			const currentCount = clients ? clients.size : 0;

			if (currentCount < maxPlayers) {
				if (!rooms[roomId]) {
					rooms[roomId] = { roomName: '', players: [], playerCount: maxPlayers, creator };
				}
				socket.join(roomId);
				joinRoomHandler(socket, roomId, userId, user, creator);
			} else {
				socket.emit('roomFull', { roomId });
				console.log(`Room ${roomId} is full.`);
			}
		} else {
			console.error(`Room not found: ${roomId}`);
		}
	});
}

// joinRoom에서 게임 시작된 방에 대한 처리 추가
function joinRoomHandler(socket, roomId, userId, user, creator) {
	const userExists = rooms[roomId].players.some(player => player.userId === userId);
	if (userExists) return;

	if (rooms[roomId].started) {
		socket.emit('gameAlreadyStarted', { roomId });
		return;
	}

	db.query('SELECT imageUrl FROM users WHERE userID = ?', [userId], (err, result) => {
		if (err) {
			console.error('Database error:', err);
			return;
		}
		const userImage = result.length > 0 ? result[0].imageUrl : 'default-image.png';
		const userInfo = { userId, userImage };
		rooms[roomId].players.push(userInfo);
		user.rooms.push(roomId);
		io.to(roomId).emit('roomUsers', rooms[roomId].players);
		const clients = io.sockets.adapter.rooms.get(roomId.toString());
		const currentCount = clients ? clients.size : 0;
		io.emit('updateRoom', { roomId, currentCount, playerCount: rooms[roomId].playerCount });

		socket.emit('joinRoomSuccess', { roomId, userId, creator });
	});
	io.to(roomId).emit('message', { message: `${userId} has joined the room.` });
}

function leaveRoom(socket, data) {
	const { roomId, userId } = data;

	const user = users.get(socket.id);
	if (!user) {
		console.error(`User not found for socket id: ${socket.id}`);
		return;
	}

	socket.leave(roomId);
	console.log(`방 종료 - ${userId}가 ${roomId}방에 나갔습니다`);

	if (rooms[roomId]) {
		rooms[roomId].players = rooms[roomId].players.filter(player => player.userId !== userId);
		io.to(roomId).emit('roomUsers', rooms[roomId].players);
		const clients = io.sockets.adapter.rooms.get(roomId.toString());
		const currentCount = clients ? clients.size : 0;
		io.emit('updateRoom', { roomId, currentCount, playerCount: rooms[roomId].playerCount });
	}

	user.rooms = user.rooms.filter(id => id !== roomId);

	io.to(roomId).emit('message', { message: `${userId} has left the room.` });
}

function updateUserImage(data) {
	const { userId, imageUrl } = data;
	const query = 'UPDATE users SET imageUrl = ? WHERE userID = ?';
	db.query(query, [imageUrl, userId], (err, result) => {
		if (err) {
			console.error('Database error:', err);
			return;
		}
		console.log(`User ${userId}'s image updated to ${imageUrl}`);
	});
}

function disconnectUser(socket) {
	const user = users.get(socket.id);
	if (user) {
		const userId = user.userId;
		const userRooms = user.rooms;

		userRooms.forEach(roomId => {
			leaveRoom(socket, { roomId, userId });
		});

		users.delete(socket.id);
		console.log(`${userId} disconnected`);
	}
}
