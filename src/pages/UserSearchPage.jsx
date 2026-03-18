import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChevronBack, IoSearchOutline, IoCloseCircle } from 'react-icons/io5';
import { searchUsers } from '../api';
import defaultProfile from '../assets/defalt.png';
import './UserSearchPage.css';

const UserSearchPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false); // 검색을 한 번이라도 실행했는지

  // 마운트 시 input 포커스
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchUsers(value.trim());
        setResults(res.data?.userProfiles || []);
        setSearched(true);
      } catch (err) {
        setResults([]);
        setSearched(true);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="user-search">
      {/* 상단 검색 바 */}
      <div className="user-search__header">
        <button className="user-search__back" onClick={() => navigate(-1)}>
          <IoChevronBack size={24} />
        </button>
        <div className="user-search__input-wrap">
          <IoSearchOutline className="user-search__search-icon" size={18} />
          <input
            ref={inputRef}
            type="text"
            className="user-search__input"
            placeholder="닉네임 검색"
            value={query}
            onChange={handleQueryChange}
            maxLength={15}
          />
          {query && (
            <button className="user-search__clear" onClick={handleClear}>
              <IoCloseCircle size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 결과 영역 */}
      <div className="user-search__body">
        {isLoading && (
          <div className="user-search__state">검색 중...</div>
        )}

        {!isLoading && searched && results.length === 0 && (
          <div className="user-search__state">검색 결과가 없습니다.</div>
        )}

        {!isLoading && !searched && (
          <div className="user-search__state user-search__state--hint">
            <IoSearchOutline size={40} />
            <p>닉네임으로 유저를 검색하세요</p>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <ul className="user-search__list">
            {results.map((user) => (
              <li
                key={user.userId}
                className="user-search__item"
                onClick={() => navigate(`/profile/${user.userId}`)}
              >
                <img
                  src={user.userProfileImageUrl || defaultProfile}
                  alt={user.nickname}
                  className="user-search__avatar"
                  onError={(e) => { e.target.src = defaultProfile; }}
                />
                <span className="user-search__nickname">{user.nickname}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default UserSearchPage;
