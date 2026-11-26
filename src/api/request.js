const TIMEOUT_MS = 10000;

// fetch with a deadline. Every provider request goes through here so that a
// server that never answers turns into an error instead of an endless wait.
export default function request(url, init) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`请求超时（${TIMEOUT_MS / 1000} 秒）：${url}`));
    }, TIMEOUT_MS);

    fetch(url, init).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
