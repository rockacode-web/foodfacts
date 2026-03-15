type SwapIdea = {
  title: string;
  description: string;
  reason?: string;
};

type SwapIdeasListProps = {
  items: SwapIdea[];
  emptyText: string;
};

const SwapIdeasList = ({ items, emptyText }: SwapIdeasListProps) => {
  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="swap-ideas-list">
      {items.slice(0, 3).map((item) => (
        <article className="swap-idea-card" key={`${item.title}-${item.description}`}>
          <strong>{item.title}</strong>
          <p>{item.description}</p>
          {item.reason && <p className="muted">{item.reason}</p>}
        </article>
      ))}
    </div>
  );
};

export default SwapIdeasList;
