# DITTO Cloud Run 배포

손님 페이지는 /, 운영 페이지는 /admin/ 입니다. GCP 빌드는 Firebase Google 로그인과 서버의 이메일 허용 목록을 적용합니다. 공개 메뉴만 손님에게 내려주며, 초안과 숨긴 메뉴는 운영 API에서만 읽을 수 있습니다.

## 준비

1. GCP 프로젝트에 Firebase를 연결하고 웹 앱을 등록합니다.
2. Firebase Authentication에서 Google 제공업체를 활성화하고 지원 이메일을 지정합니다.
3. Firestore 기본 데이터베이스를 Native 모드로 생성합니다. 이 앱은 ditto/menu 문서 하나를 사용합니다.
4. gcp-env.example.yaml을 gcp-env.yaml로 복사하고 웹 앱 설정 네 항목과 ADMIN_EMAILS를 채웁니다. 웹 API 키는 Firebase의 공개 클라이언트 설정입니다. 서비스 계정 개인 키는 넣지 않습니다.
5. gcloud에 로그인하고 과금이 연결된 프로젝트를 선택합니다.

## 서버 계정과 배포

아래 PROJECT_ID를 실제 값으로 바꿉니다. 명령은 PowerShell 기준입니다. 서버 계정은 배포 도구를 실행하는 계정과 별개입니다.

```powershell
$projectId = "PROJECT_ID"
gcloud config set project $projectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com
gcloud iam service-accounts create ditto-runtime --display-name="DITTO runtime"
$runtimeAccount = "ditto-runtime@$projectId.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$runtimeAccount" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$runtimeAccount" --role="roles/firebaseauth.viewer"
gcloud run deploy ditto-menu --source . --region asia-northeast3 --allow-unauthenticated --service-account $runtimeAccount --env-vars-file gcp-env.yaml --max-instances 3 --memory 256Mi
```

Cloud Run 주소가 나오면 해당 호스트명만 Firebase Authentication의 Settings > Authorized domains에 추가합니다. 예를 들어 https://...run.app 주소에서 https://를 뺀 값입니다. 커스텀 도메인을 쓰면 그 도메인도 추가합니다. 이후 /admin/에서 Google로 로그인합니다.

Google 팝업 로그인을 사용합니다. 브라우저가 팝업을 차단하면 허용한 뒤 로그인 버튼을 다시 누릅니다. 허용 목록에 없는 계정은 로그인해도 메뉴를 읽거나 저장할 수 없습니다. 허용 목록은 ADMIN_EMAILS 환경변수에서 관리합니다. 변경 시 Cloud Run 새 리비전을 배포합니다.

## Firestore 접근

브라우저는 Firestore에 직접 연결하지 않습니다. 서버가 Firebase ID 토큰의 유효성, 취소 여부, Google 로그인 제공업체, 인증된 이메일과 허용 목록을 확인한 뒤 서비스 계정으로 접근합니다.

포함된 firestore.rules는 클라이언트의 직접 접근을 모두 차단합니다. 이 앱 전용 Firebase 프로젝트에서 적용합니다. 기존 프로젝트에 다른 앱이 있으면 기존 규칙과 병합한 뒤 배포합니다.

```powershell
firebase deploy --only firestore:rules --project PROJECT_ID
```

최초 저장 전에는 원본 메뉴를 보여줍니다. 허용된 관리자가 처음 저장하면 Firestore에 저장되며 이후 모든 기기에서 공유합니다. 다른 관리자가 먼저 저장했으면 충돌 메시지를 표시하고 덮어쓰지 않습니다. 편집 내용을 복사한 뒤 새로고침해서 최신 메뉴에 반영합니다.

과거 시안의 localStorage 데이터는 자동으로 서버에 올리지 않습니다. 손님 화면은 페이지 로드 및 탭에 돌아올 때 최신 공개 메뉴를 불러옵니다.

## 로컬 실행과 확인

Node.js 22 이상과 npm이 필요합니다.

```powershell
npm ci
npm run build
npm test
gcloud auth application-default login
$env:FIREBASE_PROJECT_ID = "PROJECT_ID"
$env:FIREBASE_API_KEY = "WEB_API_KEY"
$env:FIREBASE_AUTH_DOMAIN = "PROJECT_ID.firebaseapp.com"
$env:FIREBASE_APP_ID = "WEB_APP_ID"
$env:ADMIN_EMAILS = "owner@example.com"
npm start
```

http://localhost:8080/admin/에서 열고 Firebase 인증 허용 도메인에 localhost를 추가합니다. GCP 외부에서는 로그인한 개발 계정에 Firestore와 Firebase Auth 조회 권한이 필요합니다.

기존 로그인 없는 로컬 시안은 node preview.cjs로 실행할 수 있습니다. GCP 빌드 npm run build는 별도의 dist/ 파일을 생성하며 항상 로그인과 서버 저장을 사용합니다. 기존 GitHub Pages docs/는 정적 시안입니다.

## 패키지

Dockerfile은 npm ci로 고정된 의존성을 설치하고 정적 파일을 빌드합니다. Cloud Run의 PORT 환경변수와 0.0.0.0 바인딩을 사용합니다. 런타임 파일시스템에 메뉴를 저장하지 않습니다.

gcp-env.yaml, .env, 서비스 계정 키, node_modules는 배포 소스나 Git에 포함하지 않습니다. Firebase/GCP 프로젝트 설정과 실계정 로그인 검증은 실제 프로젝트에서 완료해야 합니다.
