const TIMEOUT_MS = 10000;

// fetch with a deadline. Every provider request goes through here so that a
// server that never answers turns into an error instead of an endless wait.
export default function request(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
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

// The bytes of what a GET answers, for an answer whose text is not well
// formed: the device decodes such a text to nothing, so the text is not asked
// for. Fails after the same deadline.
export function requestBytes(
  url: string,
  headers: { [name: string]: string } = {}
): Promise<Uint8Array> {
  // outside the app there is only fetch, which can give the bytes itself
  if (typeof XMLHttpRequest === 'undefined') {
    return request(url, { headers })
      .then((response) => response.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer));
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = TIMEOUT_MS;
    Object.keys(headers).forEach((name) => {
      xhr.setRequestHeader(name, headers[name]);
    });
    xhr.onload = () => resolve(new Uint8Array(xhr.response));
    xhr.onerror = () => reject(new Error(`请求失败：${url}`));
    xhr.ontimeout = () =>
      reject(new Error(`请求超时（${TIMEOUT_MS / 1000} 秒）：${url}`));
    xhr.send();
  });
}
